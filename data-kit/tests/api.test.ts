import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ObservationStore, ApiError } from "../server/store";
import type { Database } from "../server/store";
import { createHandler } from "../server/http";
import individual from "../../contracts/examples/individual.json";
import group from "../../contracts/examples/group.json";

const sql=readFileSync(resolve("../database/001_ingestion.sql"),"utf8");
const seed=readFileSync(resolve("../database/demo_seed.sql"),"utf8");
const clone=<T,>(v:T):T=>structuredClone(v);
const token="test-token-abcdefghijklmnopqrstuvwxyz-123456";

describe("ingestion API + PostgreSQL engine (PGlite)",()=>{
  let db:PGlite,store:ObservationStore,handler:ReturnType<typeof createHandler>;
  beforeAll(async()=>{
    db=new PGlite();
    await db.exec(sql);await db.exec(seed);
    const adapter:Database={connect:async()=>({
      query:async(text,values)=>(await db.query(text,values)),release:()=>{},
    })};
    store=new ObservationStore(adapter);
    handler=createHandler(store,{token,missionId:"MISSION-01"});
  },30000);
  beforeEach(async()=>{await db.exec("TRUNCATE kawsay.observations,kawsay.ingestion_messages;");});
  afterAll(async()=>{await db?.close();});
  const count=async(table:string)=>Number((await db.query<{n:number}>(`SELECT count(*) AS n FROM kawsay.${table}`)).rows[0].n);
  const request=(body:unknown,headers:Record<string,string>={})=>new Request("http://localhost/api/v1/observations",{
    method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,...headers},body:JSON.stringify(body)});

  it("receives an individual then a group, reuses existing observations and retains missing states",async()=>{
    const a=await store.ingest(individual,"MISSION-01");
    expect(a.inserted).toBe(8);
    const b=await store.ingest(group,"MISSION-01");
    expect(b.inserted).toBe(2);expect(b.reused).toBe(8);
    const history=await store.history("MISSION-01","MEMBER-02","simulation:SIM-01",50);
    expect(history).toHaveLength(2);
    expect(history.every(r=>r.payload.value===null&&r.measured_at===null)).toBe(true);
  });
  it("returns the original receipt on retry, independent of JSON object-key order",async()=>{
    const a=await store.ingest(individual,"MISSION-01");
    const reordered=Object.fromEntries(Object.entries(individual).reverse());
    const b=await store.ingest(reordered,"MISSION-01");
    expect(b.duplicate).toBe(true);expect(b.received_at).toBe(a.received_at);
    expect(await count("observations")).toBe(8);
    expect(await count("ingestion_messages")).toBe(1);
  });
  it("rolls back the whole group if the second member has a wrong identity",async()=>{
    const p=clone(group);p.subjects[1].user_id="USER-01";
    // Avoid duplicate-person structural rejection; valid ID, invalid registered relation.
    p.subjects[1].user_id="USER-99";
    await expect(store.ingest(p,"MISSION-01")).rejects.toMatchObject({status:422,code:"membership_mismatch"});
    expect(await count("observations")).toBe(0);
    expect(await count("ingestion_messages")).toBe(0);
  });
  it("rejects changing a committed message or reassigning an observation to another person",async()=>{
    await store.ingest(individual,"MISSION-01");
    const p=clone(individual);p.subjects[0].observations[0].value=90;
    await expect(store.ingest(p,"MISSION-01")).rejects.toMatchObject({status:409,code:"message_conflict"});
    p.message_id="different-message";
    await expect(store.ingest(p,"MISSION-01")).rejects.toMatchObject({status:409,code:"observation_conflict"});
    const q=clone(individual);q.message_id="other-person";
    q.subjects[0].user_id="USER-02";q.subjects[0].crew_member_id="MEMBER-02";
    await expect(store.ingest(q,"MISSION-01")).rejects.toMatchObject({status:409});
    expect(await count("observations")).toBe(8);
    expect(await count("ingestion_messages")).toBe(1);
  });
  it("requires known devices, companions and simulation runs, rejecting foreign missions",async()=>{
    const p=clone(individual);p.subjects[0].observations[0].source.device_id="UNKNOWN";
    await expect(store.ingest(p,"MISSION-01")).rejects.toMatchObject({code:"unknown_device"});
    const q=clone(individual);q.subjects[0].observations[1].source.observer_user_id="OTHER";
    await expect(store.ingest(q,"MISSION-01")).rejects.toMatchObject({code:"unknown_observer"});
    const r=clone(individual);r.clock.simulation_run_id="UNKNOWN";
    await expect(store.ingest(r,"MISSION-01")).rejects.toMatchObject({code:"unknown_run"});
    await expect(store.ingest(individual,"OTHER-MISSION")).rejects.toMatchObject({status:403});
    expect(await count("ingestion_messages")).toBe(0);
  });
  it("isolates repeated identifiers across distinct simulation runs",async()=>{
    await db.exec("INSERT INTO kawsay.simulation_runs VALUES ('MISSION-01','SIM-02') ON CONFLICT DO NOTHING;");
    await store.ingest(individual,"MISSION-01");
    const p=clone(individual);p.clock.simulation_run_id="SIM-02";
    p.subjects[0].observations[0].value=90;
    await store.ingest(p,"MISSION-01");
    expect(await count("observations")).toBe(16);
    expect(await store.history("MISSION-01","MEMBER-01","simulation:SIM-01",50)).toHaveLength(8);
  });
  it("preserves original measurement time and sorts late arrivals by status time, not receipt",async()=>{
    await store.ingest(individual,"MISSION-01");
    const p=clone(individual);p.message_id="older-message";
    p.subjects[0].observations=p.subjects[0].observations.slice(0,1);
    Object.assign(p.subjects[0].observations[0],{observation_id:"older",measured_at:"2026-11-14T19:00:00-05:00",status_at:"2026-11-14T19:00:01-05:00"});
    await store.ingest(p,"MISSION-01");
    const history=await store.history("MISSION-01","MEMBER-01","simulation:SIM-01",50);
    expect(history.at(-1)?.observation_id).toBe("older");
    expect(new Date(history.at(-1)?.measured_at).toISOString()).toBe("2026-11-15T00:00:00.000Z");
  });
  it("SQL rejects an identity change that breaks the composite foreign key",async()=>{
    await store.ingest(individual,"MISSION-01");
    await expect(db.query("UPDATE kawsay.observations SET user_id='USER-02' WHERE observation_id='obs-1'")).rejects.toThrow();
  });
  it("HTTP accepts 201 then 200 on retry and bounds history reads",async()=>{
    expect((await handler(request(individual))).status).toBe(201);
    expect((await handler(request(individual))).status).toBe(200);
    const response=await handler(new Request("http://localhost/api/v1/crew-members/MEMBER-01/observations?clock_key=simulation:SIM-01&limit=2",{headers:{Authorization:"Bearer "+token}}));
    expect(response.status).toBe(200);expect((await response.json()).observations).toHaveLength(2);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const bad=await handler(new Request("http://localhost/api/v1/crew-members/MEMBER-01/observations",{headers:{Authorization:"Bearer "+token}}));
    expect(bad.status).toBe(400);
  });
  it("HTTP rejects missing auth, origins, incorrect content, oversize input and invalid payloads before storage",async()=>{
    expect((await handler(request(individual,{Authorization:"Bearer wrong"}))).status).toBe(401);
    expect((await handler(request(individual,{Origin:"http://other"}))).status).toBe(403);
    expect((await handler(request(individual,{"Content-Type":"text/plain"}))).status).toBe(415);
    expect((await handler(request(individual,{"Content-Length":"1048577"}))).status).toBe(413);
    expect((await handler(request({}))).status).toBe(422);
    const invalid=new Request("http://localhost/api/v1/observations",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:"{"});
    expect((await handler(invalid)).status).toBe(400);
    expect(await count("ingestion_messages")).toBe(0);
  });
});

// Optional full-server check. Dedicated empty test database only, never a production URL.
describe.skipIf(!process.env.KAWSAY_TEST_DATABASE_URL)("external PostgreSQL concurrency",()=>{
  let pool:pg.Pool;
  beforeAll(async()=>{
    pool=new pg.Pool({connectionString:process.env.KAWSAY_TEST_DATABASE_URL,max:3,connectionTimeoutMillis:5000});
    const exists=await pool.query("SELECT to_regclass('kawsay.missions') AS name");
    if(exists.rows[0].name)throw new Error("Use una base de pruebas vacía para este test");
    await pool.query(sql);await pool.query(seed);
  });
  afterAll(async()=>{await pool?.end();});
  it("concurrent retries insert only one complete packet",async()=>{
    const store=new ObservationStore(pool);
    const receipts=await Promise.all([store.ingest(individual,"MISSION-01"),store.ingest(individual,"MISSION-01")]);
    expect(receipts.filter(r=>r.duplicate)).toHaveLength(1);
    expect(Number((await pool.query("SELECT count(*) AS n FROM kawsay.observations")).rows[0].n)).toBe(8);
  });
});
