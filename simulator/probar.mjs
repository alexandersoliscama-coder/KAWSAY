// probar.mjs — Prueba de la fuente (source) y el reloj (clock).
import { cargarVitals, cargarConfig, filtrar } from "./source.mjs";
import { medidoEn, estadoEn } from "./clock.mjs";

const config = cargarConfig();
const registros = cargarVitals(config.rutaVitals);

console.log("Total:", registros.length);
console.log("Ana días 0-6:", filtrar(registros, "A", 0, 6).length);
console.log("Día 29 hora 23:", medidoEn(config.inicioMision, 29, 23));
console.log("Estado de d0h0:", estadoEn(medidoEn(config.inicioMision, 0, 0)));