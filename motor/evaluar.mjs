// evaluar.mjs — Decide el nivel de atención a partir de las observaciones del contrato.
// Reglas implementadas de REGLAS_CASOS.xlsx (todas en BORRADOR, pendientes de revisión clínica):
//   R19  faltan datos o son inválidos      -> INSUFFICIENT DATA
//   R01  NEWS2 total >= 7                   -> EMERGENCY
//   R02  NEWS2 total 5–6                    -> PRIORITY
//   R03  algún parámetro puntúa 3           -> PRIORITY
// Si ninguna aplica NO se asume SELF-CARE: queda sin clasificar hasta que el equipo clínico decida.

import { news2 } from "../data-kit/simulator/mission.mjs";
import { desdeContrato } from "./desde-contrato.mjs";

// Motor oficial de KAWSAY (D.13). Lo usan la API, el monitor IA (vía motor/cli.mjs)
// y cualquier vista que muestre un nivel. Subir la versión al cambiar reglas.
export const MOTOR_VERSION = "motor-oficial-0.1.0-borrador";

export function evaluar(observaciones) {
  const { v, context } = desdeContrato(observaciones);
  return evaluarVitales(v, context);
}

// Misma lógica de reglas, para entradas que ya vienen como {v, context}.
export function evaluarVitales(v, context) {
  const r = news2(v, context);
  const base = { news2: r, borrador: true, fuente: r.source };

  // El orden importa: la primera regla que se cumple decide.
  if (r.total === null)
    return { ...base, nivel: "INSUFFICIENT DATA", regla: "R19", faltan: [...r.missing, ...r.invalid] };
  if (r.total >= 7) return { ...base, nivel: "EMERGENCY", regla: "R01" };
  if (r.total >= 5) return { ...base, nivel: "PRIORITY", regla: "R02" };
  if (r.any3) return { ...base, nivel: "PRIORITY", regla: "R03" };
  return { ...base, nivel: null, regla: null, nota: "Sin regla aplicable; autocuidado por defecto pendiente de decisión clínica." };
}
