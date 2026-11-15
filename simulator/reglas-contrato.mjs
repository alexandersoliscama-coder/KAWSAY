// reglas-contrato.mjs — Las reglas ESCRITAS en CONTRATO_INGESTA_V1.md, como código.
//
// Devuelve la lista de problemas de un paquete (vacía = cumple el documento).
// No reemplaza a parseIngestion de Bryan: el validador real añade reglas que
// el documento no detalla (calendario, dominios numéricos...). Lo usa la API falsa
// para rechazar paquetes mal formados igual que lo haría la real.

const CAMPOS = {
  mensaje: ["schema_version", "message_id", "mission_id", "synthetic", "clock", "subjects"],
  reloj: ["mode", "timezone", "simulation_run_id"],
  persona: ["crew_id", "crew_member_id", "user_id", "observations"],
  observacion: ["observation_id", "parameter", "value", "unit", "measured_at", "status_at",
    "source", "availability", "report_status", "quality", "reason"],
  fuente: ["type", "device_id", "observer_user_id"],
};
const UNIDADES = { hr: "bpm", rr: "breaths/min", spo2: "%", sbp: "mmHg", dbp: "mmHg", temp: "Cel", consciousness: null, on_oxygen: null };
const CONCIENCIA = ["alert", "new_confusion", "voice", "pain", "unresponsive"];
const PERMITIDOS = {
  availability: ["measurable", "not_measurable"],
  report_status: ["reported", "pending", "not_reporting", "not_applicable"],
  quality: ["valid", "invalid", "unknown"],
};
const TIPOS_FUENTE = ["sensor", "manual", "simulator"];

const faltantes = (objeto, campos) => campos.filter((c) => !(c in (objeto ?? {})));
const fechaConZona = (s) => typeof s === "string" && /(Z|[+-]\d\d:\d\d)$/.test(s) && !isNaN(Date.parse(s));

export function erroresDelPaquete(paquete, { miembrosConocidos } = {}) {
  const errores = [];
  const e = (texto) => errores.push(texto);

  for (const c of faltantes(paquete, CAMPOS.mensaje)) e(`Falta el campo del mensaje: ${c}`);
  if (errores.length) return errores; // sin estructura básica no vale la pena seguir
  if (paquete.schema_version !== "1.0") e("schema_version debe ser \"1.0\"");
  for (const c of faltantes(paquete.clock, CAMPOS.reloj)) e(`Falta el campo del reloj: ${c}`);
  if (paquete.clock.mode === "simulation" && (!paquete.clock.simulation_run_id || paquete.synthetic !== true))
    e("El modo simulation requiere simulation_run_id y synthetic=true");
  if (!Array.isArray(paquete.subjects) || paquete.subjects.length < 1 || paquete.subjects.length > 100)
    return [...errores, "subjects debe tener entre 1 y 100 personas"];

  const usuarios = new Set(), miembros = new Set(), idsObs = new Set();
  for (const persona of paquete.subjects) {
    const quien = persona.crew_member_id ?? "(sin crew_member_id)";
    for (const c of faltantes(persona, CAMPOS.persona)) e(`${quien}: falta ${c}`);
    if (usuarios.has(persona.user_id) || miembros.has(persona.crew_member_id)) e(`${quien}: persona repetida en el mismo envío`);
    usuarios.add(persona.user_id); miembros.add(persona.crew_member_id);
    if (miembrosConocidos && !miembrosConocidos.has(persona.crew_member_id)) e(`${quien}: crew_member_id desconocido`);

    for (const o of persona.observations ?? []) {
      const donde = `${quien} / ${o.observation_id ?? "(sin observation_id)"}`;
      const falta = faltantes(o, CAMPOS.observacion);
      if (falta.length) { e(`${donde}: faltan ${falta.join(", ")}`); continue; }
      for (const c of faltantes(o.source, CAMPOS.fuente)) e(`${donde}: falta source.${c}`);
      if (idsObs.has(o.observation_id)) e(`${donde}: observation_id repetido`);
      idsObs.add(o.observation_id);

      if (!(o.parameter in UNIDADES)) e(`${donde}: parámetro desconocido "${o.parameter}"`);
      else if (o.unit !== UNIDADES[o.parameter]) e(`${donde}: unidad "${o.unit}" incorrecta para ${o.parameter} (debe ser ${JSON.stringify(UNIDADES[o.parameter])})`);
      for (const [campo, valores] of Object.entries(PERMITIDOS))
        if (!valores.includes(o[campo])) e(`${donde}: ${campo} "${o[campo]}" no permitido`);
      if (!TIPOS_FUENTE.includes(o.source?.type)) e(`${donde}: source.type "${o.source?.type}" no permitido`);
      if (["sensor", "simulator"].includes(o.source?.type) && !o.source.device_id) e(`${donde}: fuente automática sin device_id`);
      if (o.source?.type === "manual" && !o.source.observer_user_id) e(`${donde}: fuente manual sin observer_user_id`);

      if (!fechaConZona(o.status_at)) e(`${donde}: status_at sin fecha válida con zona`);
      if (o.measured_at !== null && !fechaConZona(o.measured_at)) e(`${donde}: measured_at sin fecha válida con zona`);
      if (o.measured_at && Date.parse(o.status_at) < Date.parse(o.measured_at)) e(`${donde}: status_at es anterior a measured_at`);

      if (o.report_status === "reported" && (o.value === null || o.measured_at === null)) e(`${donde}: reported requiere value y measured_at`);
      if (o.report_status !== "reported" && o.quality !== "invalid" &&
          (o.value !== null || o.measured_at !== null || o.quality !== "unknown" || !o.reason))
        e(`${donde}: sin lectura, value y measured_at deben ser null, quality unknown y reason explicarlo`);
      if (o.availability === "not_measurable" && o.report_status !== "not_applicable") e(`${donde}: not_measurable requiere not_applicable`);
      if (o.quality === "invalid" && (o.value === null || !o.reason)) e(`${donde}: una lectura inválida conserva value y reason`);

      if (o.value !== null) {
        if (o.parameter === "consciousness" && !CONCIENCIA.includes(o.value)) e(`${donde}: conciencia "${o.value}" no permitida`);
        if (o.parameter === "on_oxygen" && typeof o.value !== "boolean") e(`${donde}: on_oxygen debe ser true/false`);
        if (UNIDADES[o.parameter] && typeof o.value !== "number") e(`${donde}: ${o.parameter} debe ser un número`);
      }
    }
  }
  return errores;
}
