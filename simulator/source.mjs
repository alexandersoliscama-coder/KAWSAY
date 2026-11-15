import fs from "node:fs";

export function cargarVitals(ruta) {
  const texto = fs.readFileSync(ruta, "utf-8");
  return JSON.parse(texto);
}

export function filtrar(registros, astro, diaDesde, diaHasta) {
  return registros.filter(r => r.astro === astro && r.day >= diaDesde && r.day <= diaHasta);
}