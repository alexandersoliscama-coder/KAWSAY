import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluar } from "./evaluar.mjs";

const obs = (parameter, value, extra = {}) =>
  ({ parameter, value, report_status: "reported", quality: "valid", ...extra });
const normales = () => [
  obs("hr", 72), obs("rr", 16), obs("spo2", 98), obs("sbp", 120), obs("dbp", 78),
  obs("temp", 36.8), obs("consciousness", "alert"), obs("on_oxygen", false),
];
const con = (...nuevas) => normales().map((o) => nuevas.find((n) => n.parameter === o.parameter) ?? o);

test("R19: dato pendiente -> INSUFFICIENT DATA y dice qué falta", () => {
  const r = evaluar(con(obs("spo2", null, { report_status: "pending" })));
  assert.equal(r.nivel, "INSUFFICIENT DATA");
  assert.equal(r.regla, "R19");
  assert.ok(r.faltan.includes("spo2"));
});

test("R01: total >= 7 -> EMERGENCY", () => {
  const r = evaluar(con(obs("hr", 135), obs("rr", 26), obs("spo2", 91))); // 3+3+3 = 9
  assert.equal(r.news2.total, 9);
  assert.equal(r.nivel, "EMERGENCY");
  assert.equal(r.regla, "R01");
});

test("R02: total 5–6 sin ningún 3 -> PRIORITY", () => {
  const r = evaluar(con(obs("hr", 115), obs("rr", 22), obs("temp", 38.5))); // 2+2+1 = 5
  assert.equal(r.news2.total, 5);
  assert.equal(r.news2.any3, false);
  assert.equal(r.nivel, "PRIORITY");
  assert.equal(r.regla, "R02");
});

test("R03: un solo parámetro en 3 (total bajo) -> PRIORITY", () => {
  const r = evaluar(con(obs("consciousness", "voice"))); // total 3
  assert.equal(r.nivel, "PRIORITY");
  assert.equal(r.regla, "R03");
});

test("todo normal -> sin clasificar (no se asume SELF-CARE)", () => {
  const r = evaluar(normales());
  assert.equal(r.news2.total, 0);
  assert.equal(r.nivel, null);
  assert.equal(r.borrador, true);
});
