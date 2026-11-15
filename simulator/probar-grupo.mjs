import fs from "node:fs";
import { cargarVitals } from "./source.mjs";
import { paqueteDeHora } from "./packet.mjs";

const config = JSON.parse(fs.readFileSync("simulator/config.json", "utf-8"));
const regs = cargarVitals(config.rutaVitals);

const individual = paqueteDeHora(regs, config, ["A"], 0, 0);
const grupo = paqueteDeHora(regs, config, ["A", "B", "C", "D"], 0, 0);

console.log("Individual:", individual.message_id, "| personas:", individual.subjects.length);
console.log("Grupo:", grupo.message_id, "| personas:", grupo.subjects.length);
for (const s of grupo.subjects) {
  const ajenas = s.observations.filter(o => !o.observation_id.includes(s.crew_member_id)).length;
  console.log(" ", s.crew_member_id, "| obs:", s.observations.length, "| hr:",
    s.observations.find(o => o.parameter === "hr").value, "| ajenas:", ajenas);
}