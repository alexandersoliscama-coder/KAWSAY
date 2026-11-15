import { test } from "node:test";
import assert from "node:assert/strict";
import { news2 } from "../data-kit/simulator/mission.mjs";
import { desdeContrato } from "./desde-contrato.mjs";

// Una observación del contrato, recibida y válida.
const obs = (parameter, value, extra = {}) =>
  ({ parameter, value, report_status: "reported", quality: "valid", ...extra });

const normales = () => [
  obs("hr", 72), obs("rr", 16), obs("spo2", 98), obs("sbp", 120), obs("dbp", 78),
  obs("temp", 36.8), obs("consciousness", "alert"), obs("on_oxygen", false),
];
const cambiar = (lista, nueva) => lista.map((o) => (o.parameter === nueva.parameter ? nueva : o));

test("todo normal → NEWS2 total 0", () => {
  const { v, context } = desdeContrato(normales());
  assert.equal(news2(v, context).total, 0);
});

test("conciencia 'voice' → 3 puntos y any3", () => {
  const { v, context } = desdeContrato(cambiar(normales(), obs("consciousness", "voice")));
  const r = news2(v, context);
  assert.equal(r.total, 3);
  assert.equal(r.any3, true);
});

test("spo2 pendiente → no inventa: total null y falta spo2", () => {
  const { v, context } = desdeContrato(cambiar(normales(), obs("spo2", null, { report_status: "pending" })));
  const r = news2(v, context);
  assert.equal(r.total, null);
  assert.ok(r.missing.includes("spo2"));
});

test("calidad inválida no se usa aunque traiga número", () => {
  const { v, context } = desdeContrato(cambiar(normales(), obs("spo2", 98, { quality: "invalid" })));
  assert.ok(news2(v, context).missing.includes("spo2"));
});

test("sin conciencia reportada → falta 'alert' (omitir ≠ normal)", () => {
  const sinConciencia = normales().filter((o) => o.parameter !== "consciousness");
  const { v, context } = desdeContrato(sinConciencia);
  assert.ok(news2(v, context).missing.includes("alert"));
});