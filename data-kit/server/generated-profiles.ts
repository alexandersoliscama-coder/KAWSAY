import { createHash } from "node:crypto";
import { ApiError, canonical } from "./store";
import type { Database } from "./store";

export interface CrewMap {
  dataset_id:string; mission_id:string; crew_id:string;
  members:{source_crew_id:string;ui_demo_id:string;user_id:string;crew_member_id:string}[];
}
interface GeneratedPerson {
  id:string;name:string;sex:string;age:number;module:string;synthetic:true;
  hr:number;rr:number;spo2:number;sbp:number;temp:number;
}
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const id=(v:unknown):v is string=>typeof v==="string"&&!!v.trim()&&v.length<=128;
export function parseGeneratedCrew(input:unknown,map:unknown):{crew:GeneratedPerson[];map:CrewMap} {
  if(!obj(map)||![map.dataset_id,map.mission_id,map.crew_id].every(id)||!Array.isArray(map.members)||!map.members.length)
    throw new ApiError(422,"invalid_mapping","Correspondencia de IDs incompleta");
  const sources=new Set(),users=new Set(),members=new Set(),aliases=new Set();
  for(const link of map.members){
    if(!obj(link)||![link.source_crew_id,link.ui_demo_id,link.user_id,link.crew_member_id].every(id)||
      sources.has(link.source_crew_id)||users.has(link.user_id)||members.has(link.crew_member_id)||aliases.has(link.ui_demo_id))
      throw new ApiError(422,"invalid_mapping","Correspondencias inválidas o repetidas");
    sources.add(link.source_crew_id);users.add(link.user_id);members.add(link.crew_member_id);aliases.add(link.ui_demo_id);
  }
  if(!Array.isArray(input)||input.length!==sources.size)throw new ApiError(422,"invalid_source","Perfiles y correspondencias no coinciden");
  const seen=new Set();
  for(const p of input){
    if(!obj(p)||!id(p.id)||seen.has(p.id)||!sources.has(p.id)||p.synthetic!==true||
      !id(p.name)||!id(p.sex)||!id(p.module)||!Number.isInteger(p.age)||Number(p.age)<18||Number(p.age)>120||
      ![p.hr,p.rr,p.spo2,p.sbp,p.temp].every(n=>typeof n==="number"&&Number.isFinite(n))||
      Number(p.hr)<0||Number(p.rr)<0||Number(p.sbp)<0||Number(p.spo2)<0||Number(p.spo2)>100)
      throw new ApiError(422,"invalid_source","Perfil generado inválido o sin identificación sintética");
    seen.add(p.id);
  }
  return {crew:input as GeneratedPerson[],map:map as unknown as CrewMap};
}
function baseline(p:GeneratedPerson,map:CrewMap) {
  const unknown=()=>({status:"not_recorded",items:[]});
  return {
    schema_version:"1.0",status:"draft",synthetic:true,
    identity:{name:p.name,age_at_mission:p.age,sex:p.sex,module:p.module},
    clinical_history:{conditions:unknown(),allergies:unknown(),medications:unknown(),surgeries:unknown(),family_history:unknown()},
    baseline:{kind:"generator_configuration",measured_at:null,values:{
      hr:{value:p.hr,unit:"bpm"},rr:{value:p.rr,unit:"breaths/min"},spo2:{value:p.spo2,unit:"%"},
      sbp:{value:p.sbp,unit:"mmHg"},dbp:{value:null,unit:"mmHg"},temp:{value:p.temp,unit:"Cel"},
    }},
    provenance:{dataset_id:map.dataset_id,source_crew_id:p.id,source:"app/public/data/crew.json"},
    limitations:["Antecedentes no registrados; no equivalen a ausencia de antecedentes.",
      "Basal declarado por el generador, no una medición premisión ni media de los primeros siete días.",
      "Lab y Hab son ubicaciones, no equipos ni roles."],
  };
}
const hash=(v:unknown)=>createHash("sha256").update(canonical(v)).digest("hex");
export async function importGeneratedProfiles(db:Database,input:unknown,mapping:unknown) {
  const {crew,map}=parseGeneratedCrew(input,mapping);
  const client=await db.connect();
  let inserted=0,reused=0;
  try{
    await client.query("BEGIN");
    const team=await client.query("SELECT 1 FROM kawsay.crews WHERE mission_id=$1 AND crew_id=$2 FOR KEY SHARE",[map.mission_id,map.crew_id]);
    if(!team.rows.length)throw new ApiError(422,"unknown_crew","Registra la misión y equipo antes de importar");
    for(const p of crew){
      const link=map.members.find(m=>m.source_crew_id===p.id)!;
      await client.query("INSERT INTO kawsay.users(user_id,display_name) VALUES($1,$2) ON CONFLICT DO NOTHING",[link.user_id,p.name]);
      const user=await client.query("SELECT display_name FROM kawsay.users WHERE user_id=$1 FOR KEY SHARE",[link.user_id]);
      if(user.rows[0]?.display_name!==p.name)throw new ApiError(409,"user_conflict","El ID ya corresponde a otro nombre; no se sobrescribe");
      await client.query("INSERT INTO kawsay.crew_members(crew_member_id,mission_id,crew_id,user_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [link.crew_member_id,map.mission_id,map.crew_id,link.user_id]);
      const member=await client.query("SELECT 1 FROM kawsay.crew_members WHERE mission_id=$1 AND crew_id=$2 AND crew_member_id=$3 AND user_id=$4 FOR KEY SHARE",
        [map.mission_id,map.crew_id,link.crew_member_id,link.user_id]);
      if(!member.rows.length)throw new ApiError(409,"member_conflict","La pertenencia ya está asignada; no se sobrescribe");
      await client.query(`INSERT INTO kawsay.source_crew_links(mission_id,dataset_id,source_crew_id,ui_demo_id,crew_id,crew_member_id,user_id)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
        [map.mission_id,map.dataset_id,p.id,link.ui_demo_id,map.crew_id,link.crew_member_id,link.user_id]);
      const existing=await client.query("SELECT * FROM kawsay.source_crew_links WHERE mission_id=$1 AND dataset_id=$2 AND source_crew_id=$3 FOR KEY SHARE",
        [map.mission_id,map.dataset_id,p.id]);
      const old=existing.rows[0];
      if(!old||old.ui_demo_id!==link.ui_demo_id||old.crew_id!==map.crew_id||old.crew_member_id!==link.crew_member_id||old.user_id!==link.user_id)
        throw new ApiError(409,"mapping_conflict","Correspondencia existente diferente");
      const profile=baseline(p,map),contentHash=hash(profile);
      const saved=await client.query(`INSERT INTO kawsay.baseline_records(mission_id,crew_member_id,version,dataset_id,source_crew_id,synthetic,content_hash,profile)
        VALUES($1,$2,1,$3,$4,true,$5,$6::jsonb) ON CONFLICT DO NOTHING RETURNING version`,
        [map.mission_id,link.crew_member_id,map.dataset_id,p.id,contentHash,JSON.stringify(profile)]);
      if(saved.rows.length)inserted++;
      else{
        const record=await client.query("SELECT content_hash FROM kawsay.baseline_records WHERE mission_id=$1 AND crew_member_id=$2 AND version=1",
          [map.mission_id,link.crew_member_id]);
        if(record.rows[0]?.content_hash!==contentHash)throw new ApiError(409,"baseline_conflict","La historia base existente es diferente; requiere una revisión nueva");
        reused++;
      }
    }
    await client.query("COMMIT");
    return {dataset_id:map.dataset_id,mission_id:map.mission_id,inserted,reused};
  }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e;}
  finally{client.release();}
}
