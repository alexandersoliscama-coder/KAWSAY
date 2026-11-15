import fs from "node:fs";
import { cargarVitals } from "./source.mjs";
import { observacionesDeRegistro, armarPaquete } from "./packet.mjs";

const config = JSON.parse(fs.readFileSync("simulator/config.json", "utf-8"));
const regs = cargarVitals(config.rutaVitals);
const t = config.tripulantes.A;
const r = regs.find(x => x.astro === "A" && x.day === 0 && x.hour === 0);

const ctx = { runId: config.simulationRunId, memberId: t.crew_member_id,
              deviceId: config.deviceId, inicio: config.inicioMision };
const paquete = armarPaquete({
  messageId: `${config.simulationRunId}-msg-A-d00h00`,
  missionId: config.missionId, runId: config.simulationRunId, timezone: config.timezone,
  subjects: [{ crew_id: config.crewId, crew_member_id: t.crew_member_id, user_id: t.user_id,
               observations: observacionesDeRegistro(r, ctx) }]
});
console.log(JSON.stringify(paquete, null, 2));
console.log("Observaciones:", paquete.subjects[0].observations.length);