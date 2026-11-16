import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { applyMigrations } from "../server/migrations";
import { importGeneratedProfiles, parseGeneratedCrew } from "../server/generated-profiles";
import { serializedDatabase } from "../server/serialized-db";
import { ObservationStore } from "../server/store";
import { createHandler } from "../server/http";
import crew from "../../app/public/data/crew.json";
import mapping from "../../contracts/generated-crew-map.json";
import individual from "../../contracts/examples/individual.json";

const read=(file:string)=>readFileSync(new URL("../../"+file,import.meta.url),"utf8");
const token="test-baseline-token-abcdefghijklmnopqrstuvwxyz";
describe("generated profiles and baseline migration",()=>{
  let db:PGlite,store:ObservationStore;
  beforeEach(async()=>{
    db=new PGlite();
    await db.exec(read("database/001_ingestion.sql"));
    await db.exec(read("database/demo_seed.sql"));
    store=new ObservationStore(serializedDatabase(db));
  },30000);
  afterEach(async()=>{await db?.close();});
  const migrate=()=>applyMigrations(db,{advisoryLock:false});
  const load=()=>importGeneratedProfiles(serializedDatabase(db),crew,mapping);

  it("upgrades without changing existing telemetry, then skips applied migrations",async()=>{
    await store.ingest(individual,"MISSION-01");
    const before=await store.history("MISSION-01","MEMBER-01","simulation:SIM-01",50);
    expect(await migrate()).toEqual(["002_baselines","003_triage"]);
    expect(await migrate()).toEqual([]);
    expect(await store.history("MISSION-01","MEMBER-01","simulation:SIM-01",50)).toEqual(before);
  });
  it("applies every migration to an empty engine and refuses unknown versions",async()=>{
    const fresh=new PGlite();
    try{
      expect(await applyMigrations(fresh,{advisoryLock:false})).toEqual(["001_ingestion","002_baselines","003_triage"]);
      await fresh.query("INSERT INTO kawsay.schema_migrations(version) VALUES('999_unknown')");
      await expect(applyMigrations(fresh,{advisoryLock:false})).rejects.toThrow("desconocidas");
      expect((await fresh.query("SELECT count(*) AS n FROM kawsay.schema_migrations")).rows[0]).toEqual({n:4});
    }finally{await fresh.close();}
  },30000);
  it("imports four distinct identities, keeps unknown histories and reuses identical snapshots",async()=>{
    await migrate();
    expect(await load()).toMatchObject({inserted:4,reused:0});
    expect(await load()).toMatchObject({inserted:0,reused:4});
    const members=await store.listCrew("MISSION-01");
    expect(members).toHaveLength(6);
    expect(members.filter(m=>m.sources.length)).toHaveLength(4);
    const ana=await store.baseline("MISSION-01","GEN-MEMBER-A");
    expect(ana.profile.identity.name).toBe("Ana");
    expect(ana.profile.status).toBe("draft");
    expect(ana.profile.clinical_history.allergies).toEqual({status:"not_recorded",items:[]});
    expect(ana.profile.baseline).toMatchObject({kind:"generator_configuration",measured_at:null,values:{dbp:{value:null}}});
    expect((await store.listCrew("OTHER-MISSION"))).toEqual([]);
    await expect(store.baseline("OTHER-MISSION","GEN-MEMBER-A")).rejects.toMatchObject({status:404});
    await expect(store.baseline("MISSION-01","MEMBER-01")).rejects.toMatchObject({status:404});
    await expect(db.query("UPDATE kawsay.baseline_records SET source_crew_id='B' WHERE crew_member_id='GEN-MEMBER-A'")).rejects.toThrow();
    const packet=structuredClone(individual);
    Object.assign(packet.subjects[0],{user_id:"GEN-USER-A",crew_member_id:"GEN-MEMBER-A"});
    expect(await store.ingest(packet,"MISSION-01")).toMatchObject({inserted:8});
    expect(await store.history("MISSION-01","GEN-MEMBER-A","simulation:SIM-01",50)).toHaveLength(8);
    expect(await store.history("MISSION-01","GEN-MEMBER-B","simulation:SIM-01",50)).toEqual([]);
  });
  it("rolls back earlier imported people if a later person conflicts",async()=>{
    await migrate();
    await db.query("INSERT INTO kawsay.users VALUES('GEN-USER-D','Different person')");
    await expect(load()).rejects.toMatchObject({code:"user_conflict",status:409});
    expect((await db.query("SELECT count(*) AS n FROM kawsay.baseline_records")).rows[0]).toEqual({n:0});
    expect((await db.query("SELECT count(*) AS n FROM kawsay.source_crew_links")).rows[0]).toEqual({n:0});
    expect((await db.query("SELECT count(*) AS n FROM kawsay.users WHERE user_id='GEN-USER-A'")).rows[0]).toEqual({n:0});
  });
  it("rolls back a partially applied migration batch",async()=>{
    const fresh=new PGlite();
    try{
      const failing={query:(sql:string,values?:any[])=>fresh.query<Record<string, any>>(sql,values),exec:async(sql:string)=>{
        if(sql.includes("CREATE TABLE kawsay.baseline_records"))throw new Error("simulated migration failure");
        return fresh.exec(sql);
      }};
      await expect(applyMigrations(failing,{advisoryLock:false})).rejects.toThrow("simulated migration failure");
      expect((await fresh.query("SELECT to_regclass('kawsay.missions') AS name")).rows[0]).toEqual({name:null});
    }finally{await fresh.close();}
  },30000);
  it("refuses changed histories and reassigned aliases without overwriting",async()=>{
    await migrate();await load();
    const changed=structuredClone(crew);changed[0].hr=90;
    await expect(importGeneratedProfiles(serializedDatabase(db),changed,mapping)).rejects.toMatchObject({code:"baseline_conflict"});
    const remap=structuredClone(mapping);remap.members[0].ui_demo_id="OTHER";
    await expect(importGeneratedProfiles(serializedDatabase(db),crew,remap)).rejects.toMatchObject({code:"mapping_conflict"});
    expect((await store.baseline("MISSION-01","GEN-MEMBER-A")).profile.baseline.values.hr.value).toBe(64);
  });
  it("rejects real data, duplicate mappings and unmatched source IDs",()=>{
    const real=structuredClone(crew);real[0].synthetic=false;
    expect(()=>parseGeneratedCrew(real,mapping)).toThrow();
    const duplicate=structuredClone(mapping);duplicate.members[1].user_id=duplicate.members[0].user_id;
    expect(()=>parseGeneratedCrew(crew,duplicate)).toThrow();
    expect(()=>parseGeneratedCrew(crew.slice(1),mapping)).toThrow();
  });
  it("protects API profile reads and scopes them to the configured mission",async()=>{
    await migrate();await load();
    const handler=createHandler(store,{token,missionId:"MISSION-01"});
    const request=(path:string,auth=true)=>new Request("http://localhost/api/v1/crew-members"+path,{headers:auth?{Authorization:"Bearer "+token}:{}});
    expect((await handler(request("",false))).status).toBe(401);
    const list=await handler(request(""));
    expect(list.status).toBe(200);expect((await list.json()).members).toHaveLength(6);
    const baseline=await handler(request("/GEN-MEMBER-A/baseline"));
    expect(baseline.status).toBe(200);expect((await baseline.json()).profile.synthetic).toBe(true);
    expect((await handler(request("/unknown/baseline"))).status).toBe(404);
    const foreign=createHandler(store,{token,missionId:"OTHER-MISSION"});
    expect((await foreign(request("/GEN-MEMBER-A/baseline"))).status).toBe(404);
  });
});
