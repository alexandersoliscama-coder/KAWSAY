// historial.mjs — Convierte el historial de la API en "momentos" evaluables.
// La API real devuelve filas con la observación dentro de `payload`; la API falsa la devuelve directa.
// Todas las observaciones de una misma hora comparten status_at (aunque falte el valor),
// así que se agrupan por status_at.

import { evaluar } from "./evaluar.mjs";

const observacionDe = (fila) =>
  typeof fila.payload === "string" ? JSON.parse(fila.payload) : (fila.payload ?? fila);

export function agruparPorHora(filas) {
  const grupos = new Map();
  for (const fila of filas) {
    const o = observacionDe(fila);
    const clave = new Date(o.status_at).toISOString();
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(o);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b)) // de la más antigua a la más reciente
    .map(([momento, observaciones]) => ({ momento, observaciones }));
}

export function evaluarHistorial(filas) {
  return agruparPorHora(filas).map(({ momento, observaciones }) => ({ momento, ...evaluar(observaciones) }));
}
