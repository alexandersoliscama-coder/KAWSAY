// probar-contrato.mjs — Revisa que TODOS los paquetes del simulador cumplan el contrato escrito.
// 30 días × 24 horas en grupo + los 5 estados de equipo. No necesita la API.
import { cargarVitals, cargarConfig } from "./source.mjs";
import { paqueteDeHora } from "./packet.mjs";
import { aplicarEstado } from "./estados.mjs";
import { erroresDelPaquete } from "./reglas-contrato.mjs";

const config = cargarConfig();
const registros = cargarVitals(config.rutaVitals);
const problemas = [];
let revisados = 0;

for (let dia = 0; dia < 30; dia++)
  for (let hora = 0; hora < 24; hora++) {
    const paquete = paqueteDeHora(registros, config, ["A", "B", "C", "D"], dia, hora);
    problemas.push(...erroresDelPaquete(paquete));
    revisados++;
  }

for (const estado of ["medible", "invalida", "esperando", "sin_reporte", "sin_medio"]) {
  const paquete = paqueteDeHora(registros, config, ["A"], 0, 0);
  const persona = paquete.subjects[0];
  persona.observations = persona.observations.map((o) => aplicarEstado(o, estado, "motivo de prueba"));
  problemas.push(...erroresDelPaquete(paquete));
  revisados++;
}

console.log(`Paquetes revisados: ${revisados}`);
console.log(problemas.length ? problemas.slice(0, 10) : "Todos cumplen las reglas escritas del contrato.");
process.exitCode = problemas.length ? 1 : 0;
