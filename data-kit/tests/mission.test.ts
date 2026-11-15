import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { loadMission, missionSnapshot, parseMission } from "../src/mission";
import { checkInToInput, generatedToInput } from "../src/adapters";
import { emptyDraft, prepareCheckIn } from "../src/checkin/model";

const raw = Object.fromEntries(["crew", "vitals", "daily", "environment"].map(name => [
  name, JSON.parse(readFileSync(new URL(`../../app/public/data/${name}.json`, import.meta.url), "utf8")),
]));
const mission = parseMission(raw);

describe("generated data integration", () => {
  it("loads all four datasets and preserves exact scripted vitals", () => {
    expect(mission.vitals).toHaveLength(2880);
    expect(mission.daily).toHaveLength(120);
    expect(mission.environment).toHaveLength(1440);
    const ana = missionSnapshot(mission, "A", 19, 12);
    expect(ana.simulationTime.displayDay).toBe(20);
    expect(ana.vitals).toMatchObject({ hr: 105, rr: 22, temp: 38.5, spo2: 95 });
    expect(missionSnapshot(mission, "A", 20, 12).vitals).toMatchObject({ hr: 116, rr: 24, temp: 39.2, spo2: 94 });
  });
  it("joins environment by actual module and keeps Ben's recent history explicit", () => {
    expect(missionSnapshot(mission, "C", 22, 11).environment?.co2_mmHg).toBe(3.6);
    expect(missionSnapshot(mission, "A", 22, 11).environment!.co2_mmHg).toBeLessThan(3);
    const ben = generatedToInput(mission, "B", 15, 12);
    expect(ben.input.readiness?.eva_scheduled).toBe(true);
    expect(ben.recentDaily.filter(d => d.day >= 10 && d.day <= 14).every(d => d.kss >= 7)).toBe(true);
    expect(ben).not.toHaveProperty("fitForEVA");
  });
  it("preserves missing hours and refuses wrong dates, duplicate records and invalid data", () => {
    expect(() => missionSnapshot(mission, "A", 30, 0)).toThrow("time");
    const missing = { ...mission, vitals: mission.vitals.filter(v => !(v.astro === "A" && v.day === 19 && v.hour === 12)) };
    expect(generatedToInput(missing, "A", 19, 12).input).not.toHaveProperty("vitals");
    expect(() => parseMission({ ...raw, vitals: [...raw.vitals, raw.vitals[0]] })).toThrow("Duplicate");
    expect(() => parseMission({ ...raw, vitals: [{ ...raw.vitals[0], spo2: 101 }] })).toThrow("vitals");
    expect(() => parseMission({ ...raw, crew: [{ ...raw.crew[0], synthetic: false }] })).toThrow("synthetic");
    expect(() => parseMission({ ...raw, environment: [{ ...raw.environment[0], module: "Unknown" }] })).toThrow("environment");
  });
  it("does not invent hourly symptom absence or merge manual records", () => {
    const carla = generatedToInput(mission, "C", 22, 11);
    expect(carla.dailyContext?.reportedSymptoms).toContain("headache");
    expect(carla.input).not.toHaveProperty("symptoms");
    expect(carla.provenance.manualCheckInMerged).toBe(false);
  });
  it("maps legacy IDs and preserves false versus unknown without adding NEWS2", () => {
    const now = new Date("2026-11-13T15:00:00Z");
    for (const [crewId, canonical] of [["DEMO-01", "A"], ["DEMO-02", "B"], ["DEMO-03", "C"], ["DEMO-04", "D"]]) {
      const { record } = prepareCheckIn({ ...emptyDraft(now), crewId, values: {
        "vitals.spo2": "97", "symptoms.fatigue": "absent",
      } }, now, `record-${crewId}`);
      const adapted = checkInToInput(record!);
      expect(adapted.crewId).toBe(canonical);
      expect(adapted.input.symptoms.fatigue).toBe(false);
      expect(adapted.input.symptoms).not.toHaveProperty("dyspnea");
      expect(adapted.input.vitals.spo2).toBe(97);
      expect(adapted.input).not.toHaveProperty("news2");
      expect(adapted.provenance.checkInId).toBe(record!.id);
    }
  });
  it("surfaces loading failures rather than replacing them with empty data", async () => {
    const failing = vi.fn(async () => new Response("error", { status: 404 }));
    await expect(loadMission("/data", failing as typeof fetch)).rejects.toThrow("HTTP 404");
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      const name = String(url).split("/").at(-1)!.replace(".json", "");
      return new Response(JSON.stringify(raw[name]));
    });
    expect((await loadMission("/data", fetcher as typeof fetch)).crew).toHaveLength(4);
    expect(fetcher).toHaveBeenCalledWith("/data/crew.json");
  });
});
