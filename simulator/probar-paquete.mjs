// probar-paquete.mjs — Muestra el paquete individual de Ana (día 0, hora 0).
import { cargarVitals, cargarConfig } from "./source.mjs";
import { paqueteDeHora } from "./packet.mjs";

const config = cargarConfig();
const registros = cargarVitals(config.rutaVitals);
const paquete = paqueteDeHora(registros, config, ["A"], 0, 0);

console.log(JSON.stringify(paquete, null, 2));
console.log("Observaciones:", paquete.subjects[0].observations.length);