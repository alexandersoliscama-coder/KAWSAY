import { describe, expect, it } from "vitest";
import { parseIngestion } from "../src/ingestion";
import individual from "../../contracts/examples/individual.json";
import group from "../../contracts/examples/group.json";
describe("incoming mission data v1",()=>{
  it("accepts individual and group packets, keeping the companion's manual FR",()=>{
    const p=parseIngestion(individual);
    expect(p.subjects[0].observations.find(o=>o.parameter==="rr")?.source.observer_user_id).toBe("USER-02");
    expect(parseIngestion(group).subjects).toHaveLength(2);
    expect(p).not.toBe(individual);
  });
  it("keeps missing states without inventing normal values",()=>{
    const o=parseIngestion(group).subjects[1].observations;
    expect(o.map(x=>x.value)).toEqual([null,null]);
    expect(o.map(x=>x.report_status)).toEqual(["not_reporting","not_applicable"]);
  });
  it("rejects duplicate people and observation identifiers atomically",()=>{
    const p=structuredClone(individual);
    p.subjects.push(structuredClone(p.subjects[0]));
    expect(()=>parseIngestion(p)).toThrow(/duplicad/);
  });
  it("rejects incorrect units, implicit normality and contradictory states",()=>{
    for(const change of [
      {unit:"kPa"},{value:NaN},{value:null},{availability:"not_measurable"},{report_status:"pending"},
      {quality:"invalid",reason:null},{measured_at:"2026-11-14T20:00:00"},{measured_at:"2026-02-30T20:00:00Z"},
      {source:{type:"manual",device_id:null,observer_user_id:null}},{evaluation:"normal"},
    ]){
      const p=structuredClone(individual);
      Object.assign(p.subjects[0].observations[0],change);
      expect(()=>parseIngestion(p)).toThrow();
    }
  });
  it("isolates simulation runs and rejects simulator data pretending to be real",()=>{
    const p=structuredClone(individual);p.synthetic=false;
    expect(()=>parseIngestion(p)).toThrow();
    const q=structuredClone(individual);q.clock.simulation_run_id="";
    expect(()=>parseIngestion(q)).toThrow();
  });
  it("requires time zones and preserves independent measurement times",()=>{
    const p=structuredClone(individual);
    p.subjects[0].observations[1].measured_at="2026-11-14T19:58:00-05:00";
    expect(parseIngestion(p).subjects[0].observations[1].measured_at).toContain("19:58");
    p.clock.timezone="invalid-zone";
    expect(()=>parseIngestion(p)).toThrow(/zona horaria/);
  });
});
