import { createHash } from "node:crypto";
import { parseIngestion } from "../src/ingestion";
import type { IngestionMessage } from "../src/ingestion";

export interface DbResult { rows: Record<string, any>[]; rowCount?: number | null }
export interface DbClient { query(sql: string, values?: any[]): Promise<DbResult>; release(): void }
export interface Database { connect(): Promise<DbClient> }
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "["+value.map(canonical).join(",")+"]";
  if (value && typeof value === "object") return "{"+Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0)
    .map(([k,v])=>JSON.stringify(k)+":"+canonical(v)).join(",")+"}";
  return JSON.stringify(value);
}
const hash=(value: unknown)=>createHash("sha256").update(canonical(value)).digest("hex");
export const clockKey=(p: IngestionMessage)=>p.clock.mode==="simulation" ?
  "simulation:"+p.clock.simulation_run_id : (p.synthetic?"synthetic:real-clock":"real");
export interface IngestReceipt { message_id: string; duplicate: boolean; received_at: string; inserted: number; reused: number }

export class ObservationStore {
  constructor(private db: Database) {}
  async listCrew(mission:string) {
    const client=await this.db.connect();
    try{
      return (await client.query(`SELECT m.mission_id,m.crew_id,m.crew_member_id,m.user_id,u.display_name,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('dataset_id',l.dataset_id,'source_crew_id',l.source_crew_id,'ui_demo_id',l.ui_demo_id) ORDER BY l.dataset_id)
          FROM kawsay.source_crew_links l WHERE l.mission_id=m.mission_id AND l.crew_member_id=m.crew_member_id),'[]'::jsonb) AS sources,
        (SELECT max(b.version) FROM kawsay.baseline_records b WHERE b.mission_id=m.mission_id AND b.crew_member_id=m.crew_member_id) AS baseline_version
        FROM kawsay.crew_members m JOIN kawsay.users u ON u.user_id=m.user_id
        WHERE m.mission_id=$1 ORDER BY u.display_name,m.crew_member_id`,[mission])).rows;
    }finally{client.release();}
  }
  async baseline(mission:string,member:string) {
    const client=await this.db.connect();
    try{
      const rows=(await client.query(`SELECT mission_id,crew_member_id,version,dataset_id,source_crew_id,recorded_at,profile
        FROM kawsay.baseline_records WHERE mission_id=$1 AND crew_member_id=$2 ORDER BY version DESC LIMIT 1`,[mission,member])).rows;
      if(!rows.length)throw new ApiError(404,"baseline_not_found","No hay historia base registrada para ese tripulante y misión");
      return rows[0];
    }finally{client.release();}
  }
  async ingest(input: unknown, authorizedMission: string): Promise<IngestReceipt> {
    let p: IngestionMessage;
    try {p=parseIngestion(input);} catch(e){throw new ApiError(422,"invalid_payload",String(e));}
    if(p.mission_id!==authorizedMission)throw new ApiError(403,"mission_forbidden","Misión no autorizada");
    // First runnable endpoint is a synthetic-only MVP.
    if(!p.synthetic)throw new ApiError(422,"synthetic_only","Esta API MVP solo admite datos ficticios");
    const client=await this.db.connect(), clock=clockKey(p);
    try {
      await client.query("BEGIN");
      if(p.clock.mode==="simulation"){
        const run=await client.query("SELECT 1 FROM kawsay.simulation_runs WHERE mission_id=$1 AND simulation_run_id=$2",[p.mission_id,p.clock.simulation_run_id]);
        if(!run.rows.length)throw new ApiError(422,"unknown_run","Ejecución simulada no registrada");
      }
      // ON CONFLICT waits for a concurrent transaction; re-reading sees its committed receipt.
      const created=await client.query(`INSERT INTO kawsay.ingestion_messages
        (mission_id,clock_key,message_id,content_hash,payload) VALUES ($1,$2,$3,$4,$5::jsonb)
        ON CONFLICT DO NOTHING RETURNING received_at`,[p.mission_id,clock,p.message_id,hash(p),JSON.stringify(p)]);
      if(!created.rows.length){
        const old=await client.query("SELECT content_hash,received_at FROM kawsay.ingestion_messages WHERE mission_id=$1 AND clock_key=$2 AND message_id=$3",[p.mission_id,clock,p.message_id]);
        if(old.rows[0]?.content_hash!==hash(p))throw new ApiError(409,"message_conflict","El identificador de envío ya tiene otro contenido");
        await client.query("COMMIT");
        return {message_id:p.message_id,duplicate:true,received_at:new Date(old.rows[0].received_at).toISOString(),inserted:0,reused:p.subjects.reduce((n,s)=>n+s.observations.length,0)};
      }
      const received=new Date(created.rows[0].received_at).toISOString();
      let inserted=0,reused=0;
      for(const subject of p.subjects){
        const {crew_id,crew_member_id,user_id}=subject;
        const member=await client.query(`SELECT 1 FROM kawsay.crew_members
          WHERE mission_id=$1 AND crew_id=$2 AND crew_member_id=$3 AND user_id=$4 FOR KEY SHARE`,
          [p.mission_id,crew_id,crew_member_id,user_id]);
        if(!member.rows.length)throw new ApiError(422,"membership_mismatch","Identidad y pertenencia no coinciden");
        for(const o of subject.observations){
          if(o.source.observer_user_id!==null){
            const observer=await client.query("SELECT 1 FROM kawsay.crew_members WHERE mission_id=$1 AND crew_id=$2 AND user_id=$3 FOR KEY SHARE",[p.mission_id,crew_id,o.source.observer_user_id]);
            if(!observer.rows.length)throw new ApiError(422,"unknown_observer","Observador no pertenece al equipo");
          }
          if(o.source.type!=="manual"){
            const device=await client.query("SELECT 1 FROM kawsay.devices WHERE mission_id=$1 AND crew_id=$2 AND device_id=$3 AND source_type=$4 AND enabled=true FOR SHARE",[p.mission_id,crew_id,o.source.device_id,o.source.type]);
            if(!device.rows.length)throw new ApiError(422,"unknown_device","Dispositivo no registrado o no disponible para este equipo");
          }
          const contentHash=hash({crew_id,crew_member_id,user_id,observation:o});
          const row=await client.query(`INSERT INTO kawsay.observations
            (mission_id,clock_key,observation_id,crew_id,crew_member_id,user_id,message_id,parameter,
             measured_at,status_at,received_at,synthetic,content_hash,payload)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
            ON CONFLICT DO NOTHING RETURNING observation_id`,[
            p.mission_id,clock,o.observation_id,crew_id,crew_member_id,user_id,p.message_id,o.parameter,
            o.measured_at,o.status_at,received,p.synthetic,contentHash,JSON.stringify(o)]);
          if(row.rows.length)inserted++;
          else {
            const old=await client.query("SELECT content_hash FROM kawsay.observations WHERE mission_id=$1 AND clock_key=$2 AND observation_id=$3",[p.mission_id,clock,o.observation_id]);
            if(old.rows[0]?.content_hash!==contentHash)throw new ApiError(409,"observation_conflict","La observación ya existe con otro contenido o persona");
            reused++;
          }
        }
      }
      await client.query("COMMIT");
      return {message_id:p.message_id,duplicate:false,received_at:received,inserted,reused};
    } catch(e) {
      await client.query("ROLLBACK").catch(()=>{});
      if(e instanceof ApiError)throw e;
      if((e as {code?:string}).code==="23503")throw new ApiError(422,"reference_missing","Misión o referencia no registrada");
      throw e;
    } finally {client.release();}
  }
  async history(mission: string, member: string, clock: string, limit: number) {
    const client=await this.db.connect();
    try {
      const found=await client.query("SELECT 1 FROM kawsay.crew_members WHERE mission_id=$1 AND crew_member_id=$2",[mission,member]);
      if(!found.rows.length)throw new ApiError(404,"member_not_found","Tripulante no encontrado en la misión");
      return (await client.query(`SELECT observation_id,crew_id,crew_member_id,user_id,clock_key,measured_at,status_at,received_at,payload
        FROM kawsay.observations WHERE mission_id=$1 AND crew_member_id=$2 AND clock_key=$3
        ORDER BY status_at DESC,observation_id LIMIT $4`,[mission,member,clock,limit])).rows;
    } finally {client.release();}
  }
}
