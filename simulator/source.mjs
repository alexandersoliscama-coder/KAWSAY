// source.mjs — Fuente de datos del simulador.
// Lee vitals.json (generador de Bryan) y la configuración del simulador.
import fs from "node:fs";

export function cargarVitals(ruta) {
  const texto = fs.readFileSync(ruta, "utf-8");
  return JSON.parse(texto);
}

export function filtrar(registros, astro, diaDesde, diaHasta) {
  return registros.filter(registro => registro.astro === astro && registro.day >= diaDesde && registro.day <= diaHasta);
}

// Configuración del simulador (IDs, fecha de inicio, rutas).
export function cargarConfig() {
  return JSON.parse(fs.readFileSync("simulator/config.json", "utf-8"));
}