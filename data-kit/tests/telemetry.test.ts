import { describe, expect, it } from "vitest";
import { toTelemetry, validateTelemetry } from "../src/telemetry";
import type { Vitals } from "../src/mission";
const sample: Vitals = {astro:"A",day:19,hour:12,synthetic:true,hr:80,rr:18,
  spo2:97,sbp:120,temp:36.8,alert:true,on_oxygen:false,perfusion_index:1,
  hr_z:0,rr_z:0,spo2_z:0,temp_z:0};
describe("telemetry boundary",()=>{
  it("preserves mission time, source and missing diastolic",()=>{
    const p=toTelemetry(sample);
    expect(p.measurements.dbp).toBeNull();
    expect(p.source).toBe("simulator");
    expect(p.clock).toBe("mission");
    expect(p.sampleId).toBe("A:19:12");
    expect(p.measurements.spo2).toEqual({value:97,unit:"%"});
  });
  it("rejects false origins, invalid units, nonfinite and inconsistent readings",()=>{
    const p=toTelemetry(sample);
    for(const bad of [{...p,source:"sensor"},{...p,hour:24},{...p,synthetic:false},
      {...p,measurements:{...p.measurements,spo2:{value:101,unit:"%"}}},
      {...p,measurements:{...p.measurements,sbp:{value:NaN,unit:"mmHg"}}},
      {...p,measurements:{...p.measurements,sbp:{value:120,unit:"kPa"}}},
      {...p,measurements:{...p.measurements,dbp:{value:125,unit:"mmHg"}}}]) {
      expect(()=>validateTelemetry(bad)).toThrow();
    }
  });
});
