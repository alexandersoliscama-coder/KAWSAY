// source.mjs — Fuente de datos del simulador.
// Lee vitals.json (generador de Bryan) y la configuración del simulador.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const raiz = fileURLToPath(new URL("../", import.meta.url));

export function cargarVitals(ruta) {
  const texto = fs.readFileSync(path.resolve(raiz, ruta), "utf-8");
  return JSON.parse(texto);
}

export function filtrar(registros, astro, diaDesde, diaHasta) {
  return registros.filter(registro => registro.astro === astro && registro.day >= diaDesde && registro.day <= diaHasta);
}

// Configuración del simulador (IDs, fecha de inicio, rutas).
export function cargarConfig() {
  const config = JSON.parse(fs.readFileSync(new URL("./config.json", import.meta.url), "utf-8"));
  const mapa = JSON.parse(fs.readFileSync(path.resolve(raiz, config.rutaMapa), "utf-8"));
  return configConMapa(config, mapa);
}

// La API y el simulador comparten una única correspondencia de identidades.
export function configConMapa(config, mapa) {
  if (mapa.mission_id !== config.missionId || mapa.crew_id !== config.crewId ||
      !Array.isArray(mapa.members) || !mapa.members.length) {
    throw new Error("El mapa de tripulantes no coincide con la misión/equipo del simulador.");
  }
  const fuentes = new Set(), usuarios = new Set(), miembros = new Set();
  const tripulantes = {};
  for (const m of mapa.members) {
    if (![m.source_crew_id, m.user_id, m.crew_member_id].every(v => typeof v === "string" && v.trim()) ||
        fuentes.has(m.source_crew_id) || usuarios.has(m.user_id) || miembros.has(m.crew_member_id)) {
      throw new Error("El mapa contiene identidades vacías o repetidas.");
    }
    fuentes.add(m.source_crew_id); usuarios.add(m.user_id); miembros.add(m.crew_member_id);
    Object.defineProperty(tripulantes, m.source_crew_id, {value:{user_id:m.user_id, crew_member_id:m.crew_member_id}, enumerable:true});
  }
  return {...config, tripulantes};
}
