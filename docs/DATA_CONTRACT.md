# Data contract v1

All data are synthetic. The generator and adapters assign no clinical labels.

| File | Unique key | Fields and units |
| --- | --- | --- |
| crew | id | A–D, name, sex, age years, module Lab/Hab; hr/rr/spo2/sbp/temp are scripted centres |
| vitals | astro/day/hour | hr beats/min; rr breaths/min; spo2 percent; sbp mmHg; temp Celsius; alert; on_oxygen; perfusion_index; hr_z/rr_z/spo2_z/temp_z |
| daily | astro/day | sleep_h hours; kss 1–9; pvt_lapses count; pvt_median_ms milliseconds; feeling; symptoms; eva_scheduled |
| environment | module/day/hour | co2_mmHg synthetic hourly mean partial pressure |

Every row has `synthetic: true`. The manifest defines versions, seed, units,
resolutions, ID mapping and exact SHA-256 hashes of the four serialized files.
Seed 42 is reproducible with this Python generator, not NumPy's RNG.

## Time and baseline

- Stored days: 0–29. Display day: day + 1. Hour: 0–23.
- Indices describe simulation time, not calendar dates.
- Baseline: days 0–6, mean and sample standard deviation. Zero deviation produces
  a null z score. Incident days never update this baseline.
- Vital/environment resolution is hourly; daily records do not identify hourly
  symptom onset. Recent history excludes later days.
- Environmental rows are authored synthetic hourly means, not averages derived
  from real samples. Real ingestion must verify coverage and window alignment.
- Manual records have observedAt and recordedAt in ISO UTC. A mission clock
  mapping is required before joining them to simulation indices.

## Scenarios

| Person | Internal day/hour | Script |
| --- | --- | --- |
| Ana A | 18, 19, 20 | Exact incident HR/RR/temperature and SpO2 on 19/20 |
| Ben B | 10–14 | Short sleep, higher KSS and more lapses |
| Ben B | 15 | EVA scheduled; recent history available, no automatic decision |
| Carla C | 22, 10–13 inclusive | Hab CO2 3.6 mmHg and daily headache |
| Diego D | 25 | HR 97, RR 20, feeling fine |

Scripted values override background noise. Background uses bounded seeded noise
and a simple daily cycle. It is not a physiological model.

## Check-in

`schemaVersion: 1`, `catalogVersion: checkin-v1`, `synthetic: true`. Records include
id, crewId, observedAt, recordedAt and flat typed answers. Confirmed absence is
false; unassessed fields are omitted. At least one non-context answer is required.
Structural bounds are not clinical thresholds.

Persistence retains the practice key `kawsay.checkins.v1`. Invalid histories are
not replaced with empty ones. Duplicate IDs are rejected; failed writes retain
the review for retry. This is single-tab localStorage, not transactional storage.

## Mapping

| Check-in ID | Dataset ID | Name |
| --- | --- | --- |
| DEMO-01 | A | Ana |
| DEMO-02 | B | Ben |
| DEMO-03 | C | Carla |
| DEMO-04 | D | Diego |

`checkInToInput(record)` validates a snapshot and builds nested input from the
closed catalogue without filling missing fields. It attaches temporal provenance.
`generatedToInput(mission, id, day, hour)` selects exact observations and joins
environment by module. Recent daily history is explicit; no readiness decision
is inferred.

| Generator | Proposed motor path |
| --- | --- |
| hr | vitals.heart_rate |
| rr | vitals.respiratory_rate |
| spo2 | vitals.spo2 |
| sbp | vitals.systolic |
| temp | vitals.temperature |
| alert | vitals.alert |
| on_oxygen | vitals.on_oxygen |
| sleep_h | readiness.sleep_hours |
| co2_mmHg | environment.co2_mmHg |

The motor owner must approve its actual field names, alertness/new confusion
handling and missing-data policy. The manual catalogue is not a complete NEWS2
assessment. Daily reportedSymptoms remain separate from hourly symptom flags;
unlisted symptoms are not silently false. Manual records never automatically
overlay generated values from different timestamps.

## Consumer example

```ts
import { loadMission, generatedToInput } from './data-kit/src';
const mission = await loadMission('/data/');
const snapshot = generatedToInput(mission, 'C', 22, 11);
// snapshot.input is data only; connect through the reviewed motor adapter.
```

React consumers import CheckIn from `data-kit/src/ui/CheckIn` and its CSS. The
isolated module does not overwrite the team's app package or clinical engine.
