/** Data contract only. No clinical classifications or operational clearance. */
export type CrewId = "A" | "B" | "C" | "D";
export const CREW_CROSSWALK = {
  "DEMO-01": "A", "DEMO-02": "B", "DEMO-03": "C", "DEMO-04": "D",
} as const;

export interface Crew {
  id: CrewId; name: string; age: number; sex: string; module: string; synthetic: true;
}
export interface Vitals {
  astro: CrewId; day: number; hour: number; synthetic: true;
  hr: number; rr: number; spo2: number; sbp: number; temp: number;
  alert: boolean; on_oxygen: boolean; perfusion_index: number;
  hr_z: number | null; rr_z: number | null; spo2_z: number | null; temp_z: number | null;
}
export interface Daily {
  astro: CrewId; day: number; synthetic: true; sleep_h: number; kss: number;
  pvt_lapses: number; pvt_median_ms: number; feeling: "fine" | "not fine";
  symptoms: string[]; eva_scheduled: boolean;
}
export interface Environment {
  module: string; day: number; hour: number; co2_mmHg: number; synthetic: true;
}
export interface Mission {
  crew: Crew[]; vitals: Vitals[]; daily: Daily[]; environment: Environment[];
}
const ids: string[] = ["A", "B", "C", "D"];
const obj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const between = (x: unknown, low: number, high: number) => finite(x) && x >= low && x <= high;
const integer = (x: unknown, low: number, high: number) => between(x, low, high) && Number.isInteger(x);

/** Reject malformed/foreign/duplicate observations instead of fabricating defaults. */
export function parseMission(value: unknown): Mission {
  if (!obj(value)) throw new Error("Mission must be an object");
  const rows = (key: string): Record<string, unknown>[] => {
    const a = value[key];
    if (!Array.isArray(a) || !a.every(obj) || !a.every(r => r.synthetic === true)) {
      throw new Error(`Invalid synthetic dataset: ${key}`);
    }
    return a;
  };
  const crew = rows("crew"), vitals = rows("vitals"), daily = rows("daily"), environment = rows("environment");
  if (crew.length !== 4 || !crew.every(r => typeof r.id === "string" && ids.includes(r.id) && typeof r.name === "string" &&
    integer(r.age, 18, 120) && typeof r.sex === "string" && typeof r.module === "string")) throw new Error("Invalid crew");
  const modules = new Set(crew.map(r => r.module));
  if (!vitals.length || !vitals.every(r => typeof r.astro === "string" && ids.includes(r.astro) && integer(r.day, 0, 29) && integer(r.hour, 0, 23) &&
    [r.hr, r.rr, r.sbp, r.temp, r.perfusion_index].every(finite) && Number(r.hr) >= 0 && Number(r.rr) >= 0 &&
    Number(r.sbp) >= 0 && Number(r.perfusion_index) >= 0 && between(r.spo2, 0, 100) && typeof r.alert === "boolean" &&
    typeof r.on_oxygen === "boolean" && [r.hr_z, r.rr_z, r.spo2_z, r.temp_z].every(x => x === null || finite(x)))) {
    throw new Error("Invalid vitals");
  }
  if (!daily.length || !daily.every(r => typeof r.astro === "string" && ids.includes(r.astro) && integer(r.day, 0, 29) && between(r.sleep_h, 0, 24) &&
    integer(r.kss, 1, 9) && integer(r.pvt_lapses, 0, Number.MAX_SAFE_INTEGER) && finite(r.pvt_median_ms) &&
    r.pvt_median_ms >= 0 && typeof r.feeling === "string" && ["fine", "not fine"].includes(r.feeling) && Array.isArray(r.symptoms) &&
    r.symptoms.every(s => typeof s === "string") && typeof r.eva_scheduled === "boolean")) throw new Error("Invalid daily");
  if (!environment.length || !environment.every(r => modules.has(r.module) && integer(r.day, 0, 29) &&
    integer(r.hour, 0, 23) && finite(r.co2_mmHg) && r.co2_mmHg >= 0)) throw new Error("Invalid environment");
  for (const [name, a, fields] of [
    ["crew", crew, ["id"]], ["vitals", vitals, ["astro", "day", "hour"]],
    ["daily", daily, ["astro", "day"]], ["environment", environment, ["module", "day", "hour"]],
  ] as const) {
    const keys = a.map(r => fields.map(f => r[f]).join("|"));
    if (new Set(keys).size !== keys.length) throw new Error(`Duplicate records: ${name}`);
  }
  return { crew, vitals, daily, environment } as unknown as Mission;
}

export async function loadMission(base = "/data/", fetcher: typeof fetch = fetch): Promise<Mission> {
  const names = ["crew", "vitals", "daily", "environment"] as const;
  const values = await Promise.all(names.map(async name => {
    const response = await fetcher(`${base.replace(/\/?$/, "/")}${name}.json`);
    if (!response.ok) throw new Error(`${name}.json: HTTP ${response.status}`);
    return response.json();
  }));
  return parseMission(Object.fromEntries(names.map((n, i) => [n, values[i]])));
}

export function missionSnapshot(mission: Mission, crewId: CrewId, day: number, hour: number) {
  if (!integer(day, 0, 29) || !integer(hour, 0, 23)) throw new Error("Invalid simulation time");
  const crew = mission.crew.find(p => p.id === crewId);
  if (!crew) throw new Error("Unknown crew ID");
  return {
    crew,
    vitals: mission.vitals.find(r => r.astro === crewId && r.day === day && r.hour === hour),
    daily: mission.daily.find(r => r.astro === crewId && r.day === day),
    environment: mission.environment.find(r => r.module === crew.module && r.day === day && r.hour === hour),
    // Keep recent evidence explicit; the clinical team owns any carry-over policy.
    recentDaily: mission.daily.filter(r => r.astro === crewId && r.day < day && r.day >= day - 7),
    simulationTime: { day, hour, displayDay: day + 1 },
  };
}
