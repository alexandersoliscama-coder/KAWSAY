/** Triage on admission: input boundary. Validates and normalizes; does not classify or persist. */
export interface HistoryItem { kind: "personal" | "family"; code: string; description: string }
export interface MedicationItem { name: string; dose: string; frequency: string }
export interface ReactionItem { drug: string; reaction: string }
export interface TriageInput {
  request_id: string;
  synthetic: boolean;
  patient_id: string; full_name: string; age: number; sex: "male" | "female";
  no_known_history: boolean; history: HistoryItem[];
  no_regular_medication: boolean; medications: MedicationItem[];
  no_known_adverse_reactions: boolean; adverse_reactions: ReactionItem[];
  vitals: { hr: number; rr: number; spo2: number; temp: number; sbp: number; dbp: number };
}
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, min: number, max: number): v is string =>
  typeof v === "string" && v.trim().length >= min && v.trim().length <= max;
/** ICD-10 code, e.g. I10, E11.9, J45.909. Upper-cased on input. */
export const ICD10 = /^[A-TV-Z][0-9][0-9AB](\.[0-9A-TV-Z]{1,4})?$/;
const RANGES = {
  hr: [20, 250, true], rr: [4, 80, true], spo2: [50, 100, true],
  temp: [30, 45, false], sbp: [50, 260, true], dbp: [30, 160, true],
} as const;
const MAX_ITEMS = 30;

export function parseTriage(input: unknown): TriageInput {
  const errors: string[] = [];
  const bad = (m: string) => errors.push(m);
  if (!isObj(input)) throw new Error("El cuerpo debe ser un objeto JSON");
  const p = input;
  if (!text(p.request_id, 8, 128)) bad("request_id: 8 a 128 caracteres");
  if (p.synthetic !== true) bad("synthetic: esta API MVP solo admite datos ficticios");
  if (!text(p.patient_id, 1, 64)) bad("patient_id: 1 a 64 caracteres");
  if (!text(p.full_name, 1, 120)) bad("full_name: 1 a 120 caracteres");
  if (typeof p.age !== "number" || !Number.isInteger(p.age) || p.age < 0 || p.age > 120) bad("age: entero de 0 a 120");
  if (p.sex !== "male" && p.sex !== "female") bad("sex: male o female");

  const list = (key: string, noneKey: string, shape: (o: Obj, i: number) => unknown) => {
    const none = p[noneKey], value = p[key];
    if (typeof none !== "boolean") bad(`${noneKey}: booleano obligatorio`);
    if (!Array.isArray(value) || value.length > MAX_ITEMS) { bad(`${key}: lista de hasta ${MAX_ITEMS} elementos`); return []; }
    if (typeof none === "boolean" && none !== (value.length === 0))
      bad(none ? `${key}: marcaste "ninguno" pero hay elementos` : `${key}: agrega al menos un elemento o marca "ninguno"`);
    return value.map((o, i) => isObj(o) ? shape(o, i) : (bad(`${key}[${i}]: objeto esperado`), null));
  };
  const history = list("history", "no_known_history", (o, i) => {
    if (o.kind !== "personal" && o.kind !== "family") bad(`history[${i}].kind: personal o family`);
    const code = typeof o.code === "string" ? o.code.trim().toUpperCase() : "";
    if (!ICD10.test(code)) bad(`history[${i}].code: código CIE-10 inválido (ej. I10, E11.9)`);
    if (o.description !== undefined && o.description !== "" && !text(o.description, 1, 200)) bad(`history[${i}].description: máximo 200 caracteres`);
    return { kind: o.kind, code, description: typeof o.description === "string" ? o.description.trim() : "" };
  }) as HistoryItem[];
  const medications = list("medications", "no_regular_medication", (o, i) => {
    if (!text(o.name, 1, 120)) bad(`medications[${i}].name: obligatorio (máx. 120)`);
    for (const k of ["dose", "frequency"]) if (o[k] !== undefined && o[k] !== "" && !text(o[k], 1, 80)) bad(`medications[${i}].${k}: máximo 80 caracteres`);
    const s = (v: unknown) => typeof v === "string" ? v.trim() : "";
    return { name: s(o.name), dose: s(o.dose), frequency: s(o.frequency) };
  }) as MedicationItem[];
  const adverse_reactions = list("adverse_reactions", "no_known_adverse_reactions", (o, i) => {
    if (!text(o.drug, 1, 120)) bad(`adverse_reactions[${i}].drug: obligatorio (máx. 120)`);
    if (!text(o.reaction, 1, 200)) bad(`adverse_reactions[${i}].reaction: obligatorio (máx. 200)`);
    const s = (v: unknown) => typeof v === "string" ? v.trim() : "";
    return { drug: s(o.drug), reaction: s(o.reaction) };
  }) as ReactionItem[];

  const v = isObj(p.vitals) ? p.vitals : (bad("vitals: objeto obligatorio"), {} as Obj);
  const vitals = {} as TriageInput["vitals"];
  for (const [k, [min, max, int]] of Object.entries(RANGES)) {
    const n = v[k];
    if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) bad(`vitals.${k}: número de ${min} a ${max}${int ? " (entero)" : ""}`);
    else (vitals as Record<string, number>)[k] = int ? n : Math.round(n * 10) / 10;
  }
  if (typeof vitals.sbp === "number" && typeof vitals.dbp === "number" && vitals.sbp <= vitals.dbp) bad("vitals: la sistólica debe ser mayor que la diastólica");

  if (errors.length) throw new Error(errors.join("; "));
  const s = (x: unknown) => String(x).trim();
  return {
    request_id: s(p.request_id), synthetic: true, patient_id: s(p.patient_id), full_name: s(p.full_name),
    age: p.age as number, sex: p.sex as "male" | "female",
    no_known_history: p.no_known_history as boolean, history,
    no_regular_medication: p.no_regular_medication as boolean, medications,
    no_known_adverse_reactions: p.no_known_adverse_reactions as boolean, adverse_reactions,
    vitals,
  };
}
