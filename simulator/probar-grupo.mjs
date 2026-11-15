// probar-grupo.mjs — Comprueba que el paquete grupal no mezcla tripulantes.
import { cargarVitals, cargarConfig } from "./source.mjs";
import { paqueteDeHora } from "./packet.mjs";

const config = cargarConfig();
const registros = cargarVitals(config.rutaVitals);

const individual = paqueteDeHora(registros, config, ["A"], 0, 0);
const grupo = paqueteDeHora(registros, config, ["A", "B", "C", "D"], 0, 0);

console.log("Individual:", individual.message_id, "| personas:", individual.subjects.length);
console.log("Grupo:", grupo.message_id, "| personas:", grupo.subjects.length);
for (const persona of grupo.subjects) {
  const ajenas = persona.observations.filter(obs => !obs.observation_id.includes(persona.crew_member_id)).length;
  const fc = persona.observations.find(obs => obs.parameter === "hr").value;
  console.log(" ", persona.crew_member_id, "| obs:", persona.observations.length, "| hr:", fc, "| ajenas:", ajenas);
}