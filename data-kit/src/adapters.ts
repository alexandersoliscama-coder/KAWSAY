import { isCheckIn } from "./checkin/model";
import type { CheckIn } from "./checkin/model";
import { CREW_CROSSWALK, missionSnapshot } from "./mission";
import type { CrewId, Mission } from "./mission";

/** Draft integration contract. The motor branch must explicitly accept these paths. */
export function checkInToInput(record: CheckIn) {
  if (!isCheckIn(record)) throw new Error("Invalid check-in");
  const input: Record<string, Record<string, string | number | boolean>> = {};
  for (const [path, value] of Object.entries(record.answers)) {
    const [group, key] = path.split(".");
    (input[group] ??= {})[key] = value;
  }
  return {
    crewId: CREW_CROSSWALK[record.crewId as keyof typeof CREW_CROSSWALK],
    input,
    provenance: { synthetic: true as const, checkInId: record.id, observedAt: record.observedAt,
      recordedAt: record.recordedAt, catalogVersion: record.catalogVersion },
  };
}

/** Generated time-series and manual check-ins stay separate; no implicit overlay. */
export function generatedToInput(mission: Mission, id: CrewId, day: number, hour: number) {
  const snapshot = missionSnapshot(mission, id, day, hour);
  const v = snapshot.vitals, d = snapshot.daily, e = snapshot.environment;
  return {
    crewId: id,
    input: {
      ...(v ? { vitals: { heart_rate: v.hr, respiratory_rate: v.rr, spo2: v.spo2,
        systolic: v.sbp, temperature: v.temp, alert: v.alert, on_oxygen: v.on_oxygen,
        perfusion_index: v.perfusion_index } } : {}),
      ...(d ? { readiness: { sleep_hours: d.sleep_h, kss: d.kss, pvt_lapses: d.pvt_lapses,
        pvt_median_ms: d.pvt_median_ms, eva_scheduled: d.eva_scheduled } } : {}),
      ...(e ? { environment: { co2_mmHg: e.co2_mmHg } } : {}),
    },
    // Daily symptom onset is unknown; do not backfill negative hourly answers.
    dailyContext: d ? { feeling: d.feeling, reportedSymptoms: [...d.symptoms], resolution: "daily" } : null,
    recentDaily: snapshot.recentDaily,
    provenance: { synthetic: true as const, source: "generated", ...snapshot.simulationTime,
      environmentResolution: "synthetic_hourly_mean", manualCheckInMerged: false },
  };
}
