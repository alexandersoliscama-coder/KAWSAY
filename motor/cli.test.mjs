import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { evaluarEntrada } from "./cli.mjs";
import { desdeGenerador } from "./desde-generador.mjs";

const CLI = fileURLToPath(new URL("./cli.mjs", import.meta.url));
const normal = { hr: 72, rr: 16, spo2: 98, sbp: 120, temp: 36.8, alert: true, on_oxygen: false };

test("generador: un dato ausente queda ausente, nunca normal", () => {
  const { v, context } = desdeGenerador({ ...normal, spo2: null });
  assert.equal("spo2" in v, false);
  assert.equal(context.alert, true);
  assert.equal(context.onOxygen, false);
});

test("vitals del generador usan las mismas reglas que el contrato", () => {
  assert.equal(evaluarEntrada({ vitals: normal }).news2.total, 0);
  const r = evaluarEntrada({ vitals: { ...normal, hr: 135, rr: 26, spo2: 91 } });
  assert.equal(r.nivel, "EMERGENCY");
  assert.equal(r.regla, "R01");
});

test("dato faltante -> R19, medir de nuevo", () => {
  const r = evaluarEntrada({ vitals: { ...normal, sbp: undefined } });
  assert.equal(r.nivel, "INSUFFICIENT DATA");
  assert.equal(r.regla, "R19");
  assert.ok(r.faltan.includes("sbp"));
});

test("el CLI responde JSON con motor y versión", () => {
  const out = spawnSync(process.execPath, [CLI], { input: JSON.stringify({ vitals: normal }), encoding: "utf8" });
  assert.equal(out.status, 0, out.stderr);
  const r = JSON.parse(out.stdout);
  assert.equal(r.motor, "motor/evaluar.mjs");
  assert.match(r.version, /borrador/);
});

test("el CLI rechaza entradas inválidas con código 2", () => {
  const out = spawnSync(process.execPath, [CLI], { input: "{}", encoding: "utf8" });
  assert.equal(out.status, 2);
});
