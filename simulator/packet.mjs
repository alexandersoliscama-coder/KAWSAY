// packet.mjs — Arma paquetes del contrato de ingesta v1.
// registro de vitals.json -> 8 observaciones -> una persona (subject) -> paquete.

import { medidoEn, estadoEn } from "./clock.mjs";
import { idObservacion, idMensaje } from "./ids.mjs";
import { diastolicaSintetica } from "./sintetico.mjs";

export const UNIDADES = {
  hr: "bpm", rr: "breaths/min", spo2: "%", sbp: "mmHg", dbp: "mmHg",
  temp: "Cel", consciousness: null, on_oxygen: null
};

// Variables que vienen directo del generador.
const VARIABLES_DEL_GENERADOR = ["hr", "rr", "spo2", "sbp", "temp"];

// Una lectura recibida y válida (report_status=reported, quality=valid).
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

// Convierte UN registro horario del generador en sus observaciones.
export function observacionesDeRegistro(registro, contexto) {
  const base = { ...contexto, day: registro.day, hour: registro.hour };
  const lista = [];

  for (const parametro of VARIABLES_DEL_GENERADOR) {
    lista.push(observacionLeida({ ...base, parametro, valor: registro[parametro] }));
  }

  // Diastólica: el generador no la trae; se crea de forma reproducible (D.08).
  const clave = idObservacion(contexto.runId, contexto.memberId, registro.day, registro.hour, "dbp");
  lista.push(observacionLeida({ ...base, parametro: "dbp", valor: diastolicaSintetica(registro.sbp, clave) }));

  // Conciencia: solo si el generador confirma "alerta". Si no, se omite (omitir ≠ normal).
  if (registro.alert === true) {
    lista.push(observacionLeida({ ...base, parametro: "consciousness", valor: "alert" }));
  }

  lista.push(observacionLeida({ ...base, parametro: "on_oxygen", valor: registro.on_oxygen }));
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

// Paquete de UNA hora para uno o varios tripulantes: ["A"] o ["A","B","C","D"].
export function paqueteDeHora(registros, config, astros, day, hour) {
  const subjects = [];
  for (const astro of astros) {
    const tripulante = config.tripulantes[astro];
    const registro = registros.find(r => r.astro === astro && r.day === day && r.hour === hour);
    if (!registro) throw new Error(`No hay registro de ${astro} en día ${day}, hora ${hour}`);

    const contexto = {
      runId: config.simulationRunId,
      memberId: tripulante.crew_member_id,
      deviceId: config.deviceId,
      inicio: config.inicioMision
    };
    subjects.push({
      crew_id: config.crewId,
      crew_member_id: tripulante.crew_member_id,
      user_id: tripulante.user_id,
      observations: observacionesDeRegistro(registro, contexto)
    });
  }
  return armarPaquete({
    messageId: idMensaje(config.simulationRunId, astros, day, hour),
    missionId: config.missionId,
    runId: config.simulationRunId,
    timezone: config.timezone,
    subjects
  });
}
