import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { ObservationStore } from "../server/store";
import { serializedDatabase } from "../server/serialized-db";
import { applyMigrations } from "../server/migrations";
import { createHandler } from "../server/http";
import { parseTriage } from "../src/triage";

const read=(f:string)=>readFileSync(new URL("../../"+f,import.meta.url),"utf8");
const token="test-triage-token-abcdefghijklmnopqrstuvwxyz";
const valid=()=>structuredClone({
  request_id:"req-0001-abcdef",synthetic:true,patient_id:"PAT-001",full_name:"Ana Demo",age:34,sex:"female",
  no_known_history:false,history:[{kind:"personal",code:"i10",description:"Hypertension"},{kind:"family",code:"E11.9",description:""}],
  no_regular_medication:false,medications:[{name:"Losartan",dose:"50 mg",frequency:"once daily"}],
  no_known_adverse_reactions:false,adverse_reactions:[{drug:"Penicillin",reaction:"Rash"}],
  vitals:{hr:72,rr:16,spo2:98,temp:36.6,sbp:118,dbp:76},
});

describe("triage input validation",()=>{
  it("accepts a complete record and normalizes ICD-10 codes",()=>{
    const t=parseTriage(valid());
    expect(t.history[0].code).toBe("I10");
    expect(t.vitals.temp).toBe(36.6);
  });
  it("accepts explicit 'none' for each list",()=>{
    const p=valid();Object.assign(p,{no_known_history:true,history:[],no_regular_medication:true,medications:[],no_known_adverse_reactions:true,adverse_reactions:[]});
    expect(parseTriage(p).history).toEqual([]);
  });
  it.each([
    ["real (non-synthetic) data",(p:any)=>{p.synthetic=false}],
    ["invalid ICD-10 code",(p:any)=>{p.history[0].code="HYPERTENSION"}],
    ["empty list without the 'none' flag",(p:any)=>{p.medications=[]}],
    ["'none' flag with items",(p:any)=>{p.no_regular_medication=true}],
    ["age out of range",(p:any)=>{p.age=150}],
    ["unknown sex",(p:any)=>{p.sex="x"}],
    ["missing vital",(p:any)=>{delete p.vitals.rr}],
    ["SpO2 above 100",(p:any)=>{p.vitals.spo2=101}],
    ["systolic not above diastolic",(p:any)=>{p.vitals.sbp=70;p.vitals.dbp=80}],
    ["reaction without description",(p:any)=>{p.adverse_reactions[0].reaction=""}],
    ["non-object body",(p:any)=>{throw 0}],
  ])("rejects %s",(_n,mutate)=>{
    const p:any=valid();
    try{mutate(p);}catch{expect(()=>parseTriage(null)).toThrow();return;}
    expect(()=>parseTriage(p)).toThrow();
  });
});

describe("triage storage + HTTP (PGlite)",()=>{
  let db:PGlite,store:ObservationStore,handler:ReturnType<typeof createHandler>;
  beforeAll(async()=>{
    db=new PGlite();
    await db.exec(read("database/001_ingestion.sql"));await db.exec(read("database/demo_seed.sql"));
    await applyMigrations(db,{advisoryLock:false});
    store=new ObservationStore(serializedDatabase(db));
    handler=createHandler(store,{token,missionId:"MISSION-01"});
  },30000);
  beforeEach(async()=>{await db.exec("TRUNCATE kawsay.triage_records;");});
  afterAll(async()=>{await db?.close();});
  const call=(path:string,init:RequestInit={})=>handler(new Request("http://localhost"+path,{...init,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json",...(init.headers as object)}}));
  const post=(body:unknown)=>call("/api/v1/triage",{method:"POST",body:JSON.stringify(body)});

  it("saves a triage and returns it by id and in the list",async()=>{
    const res=await post(valid());expect(res.status).toBe(201);
    const {triage_id}=await res.json();
    const one=await (await call("/api/v1/triage/"+triage_id)).json();
    expect(one).toMatchObject({patient_id:"PAT-001",full_name:"Ana Demo",age:34,sex:"female",hr:72,temp:36.6,sbp:118,dbp:76});
    expect(one.history).toHaveLength(2);expect(one.medications[0].name).toBe("Losartan");
    const list=await (await call("/api/v1/triage?limit=10")).json();
    expect(list.triage).toHaveLength(1);
  });
  it("is idempotent for the same request_id and rejects a different body with the same id",async()=>{
    const a=await (await post(valid())).json();
    const again=await post(valid());expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({triage_id:a.triage_id,duplicate:true});
    const changed=valid();changed.vitals.hr=90;
    expect((await post(changed)).status).toBe(409);
    expect((await db.query("SELECT count(*)::int AS n FROM kawsay.triage_records")).rows[0]).toEqual({n:1});
  });
  it("keeps several admissions of the same patient, newest first, and filters by patient",async()=>{
    await post(valid());
    const second=valid();second.request_id="req-0002-abcdef";second.vitals.hr=101;await post(second);
    const other=valid();other.request_id="req-0003-abcdef";other.patient_id="PAT-002";await post(other);
    const mine=await (await call("/api/v1/triage?patient_id=PAT-001")).json();
    expect(mine.triage.map((t:any)=>t.hr)).toEqual([101,72]);
  });
  it("returns 422 for invalid data, 404 for unknown id and 401 without token; nothing is written on failure",async()=>{
    const bad=valid();bad.history[0].code="nope";
    const res=await post(bad);expect(res.status).toBe(422);
    expect((await res.json()).message).toContain("CIE-10");
    expect((await call("/api/v1/triage/999")).status).toBe(404);
    expect((await handler(new Request("http://localhost/api/v1/triage"))).status).toBe(401);
    expect((await call("/api/v1/triage?limit=0")).status).toBe(400);
    expect((await call("/api/v1/triage",{method:"POST",body:"{",headers:{}})).status).toBe(400);
    expect((await db.query("SELECT count(*)::int AS n FROM kawsay.triage_records")).rows[0]).toEqual({n:0});
  });
  it("database constraints reject inconsistent rows even if the API is bypassed",async()=>{
    await expect(db.query(`INSERT INTO kawsay.triage_records(mission_id,request_id,content_hash,synthetic,patient_id,full_name,age,sex,
      no_known_history,history,no_regular_medication,medications,no_known_adverse_reactions,adverse_reactions,hr,rr,spo2,temp,sbp,dbp)
      VALUES('MISSION-01','x','h',true,'P','N',30,'male',true,'[{"a":1}]',true,'[]',true,'[]',70,16,98,36.5,120,80)`)).rejects.toThrow();
  });
});
