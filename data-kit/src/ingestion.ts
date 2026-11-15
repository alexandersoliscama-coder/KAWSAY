/** Proposed input boundary. Does not assign a clinical classification or persist data. */
export const PARAMETER_UNITS = {
  hr: "bpm", rr: "breaths/min", spo2: "%", sbp: "mmHg", dbp: "mmHg",
  temp: "Cel", consciousness: null, on_oxygen: null,
} as const;
export type Parameter = keyof typeof PARAMETER_UNITS;
export interface IncomingObservation {
  observation_id: string;
  parameter: Parameter;
  value: number | string | boolean | null;
  unit: string | null;
  measured_at: string | null;
  status_at: string;
  source: { type: "sensor" | "manual" | "simulator"; device_id: string | null; observer_user_id: string | null };
  availability: "measurable" | "not_measurable";
  report_status: "reported" | "pending" | "not_reporting" | "not_applicable";
  quality: "valid" | "invalid" | "unknown";
  reason: string | null;
}
export interface IncomingSubject {
  crew_id: string; crew_member_id: string; user_id: string;
  observations: IncomingObservation[];
}
export interface IngestionMessage {
  schema_version: "1.0"; message_id: string; mission_id: string; synthetic: boolean;
  clock: { mode: "real" | "simulation"; timezone: string; simulation_run_id: string | null };
  subjects: IncomingSubject[];
}
type ObjectValue = Record<string, unknown>;
const object = (v: unknown): v is ObjectValue => !!v && typeof v === "object" && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 128;
const oneOf = (v: unknown, list: readonly unknown[]) => list.includes(v);
function timestamp(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v) || !Number.isFinite(Date.parse(v))) return false;
  const date = v.slice(0,10);
  return new Date(date+"T00:00:00Z").toISOString().slice(0,10) === date;
}
/** Returns every error. Reject the entire batch before writing any subject. */
export function parseIngestion(input: unknown): IngestionMessage {
  const errors: string[] = [];
  function shape(v: unknown, keys: string[], path: string): v is ObjectValue {
    if (!object(v)) { errors.push(path+": se requiere un objeto"); return false; }
    for (const k of keys) if (!(k in v)) errors.push(path+"."+k+": campo requerido");
    for (const k of Object.keys(v)) if (!keys.includes(k)) errors.push(path+"."+k+": campo desconocido");
    return true;
  }
  const check = (ok: boolean, message: string) => { if (!ok) errors.push(message); };
  if (!shape(input,["schema_version","message_id","mission_id","synthetic","clock","subjects"],"message")) throw new Error(errors.join("\n"));
  check(input.schema_version==="1.0","schema_version: versión no soportada");
  check(id(input.message_id)&&id(input.mission_id),"message_id / mission_id: identificadores requeridos");
  check(typeof input.synthetic==="boolean","synthetic: se requiere booleano");
  if(shape(input.clock,["mode","timezone","simulation_run_id"],"clock")){
    const c=input.clock;
    check(oneOf(c.mode,["real","simulation"]),"clock.mode: inválido");
    try { if(typeof c.timezone!=="string"||!c.timezone)throw Error(); new Intl.DateTimeFormat("en",{timeZone:c.timezone}); }
    catch {errors.push("clock.timezone: zona horaria desconocida");}
    check(c.mode==="simulation" ? id(c.simulation_run_id)&&input.synthetic===true : c.simulation_run_id===null,
      "clock: simulación requiere run_id y synthetic=true; reloj real requiere run_id=null");
  }
  const subjects = input.subjects;
  if(!Array.isArray(subjects)||subjects.length<1||subjects.length>100) errors.push("subjects: se requieren entre 1 y 100 personas");
  else {
    const memberships=new Set<string>(),users=new Set<string>(),observations=new Set<string>();
    subjects.forEach((s,i)=>{
      const path="subjects["+i+"]";
      if(!shape(s,["crew_id","crew_member_id","user_id","observations"],path))return;
      check(id(s.crew_id)&&id(s.crew_member_id)&&id(s.user_id),path+": identificadores inválidos");
      check(!memberships.has(String(s.crew_member_id))&&!users.has(String(s.user_id)),path+": persona o pertenencia duplicada");
      memberships.add(String(s.crew_member_id));users.add(String(s.user_id));
      if(!Array.isArray(s.observations)||!s.observations.length||s.observations.length>100){errors.push(path+".observations: entre 1 y 100 registros");return;}
      s.observations.forEach((o,j)=>{
        const at=path+".observations["+j+"]";
        if(!shape(o,["observation_id","parameter","value","unit","measured_at","status_at","source","availability","report_status","quality","reason"],at))return;
        check(id(o.observation_id),at+": observation_id inválido");
        check(!observations.has(String(o.observation_id)),at+": observation_id duplicado");
        observations.add(String(o.observation_id));
        const parameter=o.parameter;
        check(typeof parameter==="string"&&Object.hasOwn(PARAMETER_UNITS,parameter),at+": parámetro desconocido");
        if(typeof parameter==="string"&&Object.hasOwn(PARAMETER_UNITS,parameter))check(o.unit===PARAMETER_UNITS[parameter as Parameter],at+": unidad incorrecta");
        check(timestamp(o.status_at),at+": status_at debe tener fecha y zona");
        check(oneOf(o.availability,["measurable","not_measurable"]),at+": disponibilidad inválida");
        check(oneOf(o.report_status,["reported","pending","not_reporting","not_applicable"]),at+": reporte inválido");
        check(oneOf(o.quality,["valid","invalid","unknown"]),at+": calidad inválida");
        check(o.reason===null || (typeof o.reason==="string"&&o.reason.trim().length>0&&o.reason.length<=500),at+": motivo inválido");
        check((o.availability==="not_measurable")===(o.report_status==="not_applicable"),at+": sin medio disponible implica reporte no aplicable");
        if(o.report_status==="reported"){
          check(o.availability==="measurable"&&timestamp(o.measured_at),at+": lectura requiere medio y momento de medición");
          if(timestamp(o.measured_at)&&timestamp(o.status_at))check(Date.parse(o.measured_at)<=Date.parse(o.status_at),at+": estado anterior a la medición");
          if(parameter==="on_oxygen")check(typeof o.value==="boolean",at+": oxígeno suplementario debe ser booleano");
          else if(parameter==="consciousness")check(oneOf(o.value,["alert","new_confusion","voice","pain","unresponsive"]),at+": conciencia inválida");
          else {
            check(typeof o.value==="number"&&Number.isFinite(o.value),at+": se requiere valor numérico finito");
            if(typeof o.value==="number")check((parameter==="temp"||o.value>=0)&&(parameter!=="spo2"||o.value<=100),at+": valor fuera del dominio técnico");
          }
          if(o.quality==="invalid")check(typeof o.reason==="string"&&o.reason.trim().length>0,at+": lectura inválida requiere motivo");
        }else check(o.value===null&&o.measured_at===null&&o.quality==="unknown"&&typeof o.reason==="string"&&o.reason.trim().length>0,at+": ausencia requiere null, calidad desconocida y motivo");
        if(shape(o.source,["type","device_id","observer_user_id"],at+".source")){
          const source=o.source;
          check(oneOf(source.type,["sensor","manual","simulator"]),at+": origen inválido");
          check(source.device_id===null||id(source.device_id),at+": device_id inválido");
          check(source.observer_user_id===null||id(source.observer_user_id),at+": observer_user_id inválido");
          if(source.type==="manual")check(id(source.observer_user_id),at+": registro manual requiere observador");
          else check(id(source.device_id),at+": origen automático requiere device_id");
          if(source.type==="simulator")check(input.synthetic===true,at+": simulador requiere synthetic=true");
        }
      });
    });
  }
  if(errors.length)throw new Error(errors.join("\n"));
  return structuredClone(input) as unknown as IngestionMessage;
}

/** Required policy; null means not agreed yet, never an implicit clinical default. */
export interface TimingPolicy {
  policy_version: string;
  missing_after_seconds: Partial<Record<Parameter, number | null>>;
  grouping_window_seconds: number | null;
}
