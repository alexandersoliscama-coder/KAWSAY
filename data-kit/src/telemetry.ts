import type { Vitals, CrewId } from "./mission";

export interface TelemetryPacket {
  schemaVersion: 1;
  sampleId: string;
  crewId: CrewId;
  synthetic: true;
  source: "simulator";
  clock: "mission";
  day: number;
  hour: number;
  measurements: {
    sbp: { value: number; unit: "mmHg" };
    dbp: { value: number; unit: "mmHg" } | null;
    spo2: { value: number; unit: "%" };
  };
  quality: "unverified";
}

/** Existing series contain no diastolic value. Never infer it from systolic BP. */
export function toTelemetry(v: Vitals): TelemetryPacket {
  return validateTelemetry({
    schemaVersion: 1, sampleId: `${v.astro}:${v.day}:${v.hour}`,
    crewId: v.astro, synthetic: true, source: "simulator", clock: "mission",
    day: v.day, hour: v.hour,
    measurements: { sbp: { value: v.sbp, unit: "mmHg" }, dbp: null,
      spo2: { value: v.spo2, unit: "%" } }, quality: "unverified",
  });
}

export function validateTelemetry(input: unknown): TelemetryPacket {
  if (!input || typeof input !== "object") throw new Error("Paquete ausente");
  const p = input as TelemetryPacket;
  const valid = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  if (p.schemaVersion !== 1 || !["A","B","C","D"].includes(p.crewId) ||
      p.synthetic !== true || p.source !== "simulator" || p.clock !== "mission" ||
      typeof p.sampleId !== "string" || !p.sampleId ||
      !Number.isInteger(p.day) || !valid(p.day,0,29) ||
      !Number.isInteger(p.hour) || !valid(p.hour,0,23) || p.quality !== "unverified" ||
      !valid(p.measurements?.sbp?.value, 1, 350) || p.measurements.sbp.unit !== "mmHg" ||
      !valid(p.measurements?.spo2?.value, 0, 100) || p.measurements.spo2.unit !== "%" ||
      (p.measurements.dbp !== null && (!valid(p.measurements.dbp?.value,1,250) ||
        p.measurements.dbp.unit !== "mmHg" || p.measurements.dbp.value >= p.measurements.sbp.value))) {
    throw new Error("Telemetría inválida: revisar origen, reloj, unidades y valores");
  }
  return p;
}
