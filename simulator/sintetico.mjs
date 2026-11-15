// sintetico.mjs — Valores que el generador no trae y el simulador debe crear (D.08).
// Son reproducibles: la misma clave produce siempre el mismo valor.

const FACTOR_DIASTOLICA = 0.65;   // diastólica ≈ 65 % de la sistólica
const RUIDO_MAX_MMHG = 3;         // variación de ± 3 mmHg

// Número entre 0 y 1 que depende SOLO del texto (hash FNV-1a).
// Misma clave -> mismo número, en cualquier computadora.
function azarFijo(clave) {
  let hash = 2166136261;
  for (const caracter of clave) {
    hash ^= caracter.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export function diastolicaSintetica(sistolica, clave) {
  const ruido = Math.round(azarFijo(clave) * 2 * RUIDO_MAX_MMHG - RUIDO_MAX_MMHG);
  return Math.round(sistolica * FACTOR_DIASTOLICA) + ruido;
}
