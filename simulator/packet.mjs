import { medidoEn, estadoEn } from "./clock.mjs";

export const UNIDADES = {
  hr: "bpm", rr: "breaths/min", spo2: "%", sbp: "mmHg", dbp: "mmHg",
  temp: "Cel", consciousness: null, on_oxygen: null
};

function dosDigitos(n) { return String(n).padStart(2, "0"); }

export function idObservacion(runId, memberId, day, hour, parametro) {
  return `${runId}-${memberId}-d${dosDigitos(day)}h${dosDigitos(hour)}-${parametro}`;
}

export function observacionLeida({ runId, memberId, deviceId, inicio, day, hour, parametro, valor }) {
  const medido = medidoEn(inicio, day, hour);
  return {
    observation_id: idObservacion(runId, memberId, day, hour, parametro),
    parameter: parametro,
    value: valor,
    unit: UNIDADES[parametro],
    measured_at: medido,
    status_at: estadoEn(medido),
    source: { type: "simulator", device_id: deviceId, observer_user_id: null },
    availability: "measurable",
    report_status: "reported",
    quality: "valid",
    reason: null
  };
}

// Número entre 0 y 1 que depende SOLO del texto: misma clave -> mismo número.
function azarFijo(clave) {
  let h = 2166136261;
  for (const c of clave) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

// D.08: diastólica sintética = 65 % de la sistólica ± 3 mmHg, fija por registro.
export function diastolicaSintetica(sbp, clave) {
  const ruido = Math.round(azarFijo(clave) * 6 - 3);
  return Math.round(sbp * 0.65) + ruido;
}

export function observacionesDeRegistro(r, ctx) {
  const base = { ...ctx, day: r.day, hour: r.hour };
  const lista = [];
  for (const p of ["hr", "rr", "spo2", "sbp", "temp"]) {
    lista.push(observacionLeida({ ...base, parametro: p, valor: r[p] }));
  }
  const clave = idObservacion(ctx.runId, ctx.memberId, r.day, r.hour, "dbp");
  lista.push(observacionLeida({ ...base, parametro: "dbp", valor: diastolicaSintetica(r.sbp, clave) }));
  if (r.alert === true) {
    lista.push(observacionLeida({ ...base, parametro: "consciousness", valor: "alert" }));
  }
  lista.push(observacionLeida({ ...base, parametro: "on_oxygen", valor: r.on_oxygen }));
  return lista;
}

export function armarPaquete({ messageId, missionId, runId, timezone, subjects }) {
  return {
    schema_version: "1.0",
    message_id: messageId,
    mission_id: missionId,
    synthetic: true,
    clock: { mode: "simulation", timezone, simulation_run_id: runId },
    subjects
  };
}