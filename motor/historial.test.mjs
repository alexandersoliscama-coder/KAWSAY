import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparPorHora, evaluarHistorial } from "./historial.mjs";

const T0 = "2026-10-01T05:00:01.000Z", T1 = "2026-10-01T06:00:01.000Z";
const obs = (parameter, value, status_at, extra = {}) =>
  ({ parameter, value, status_at, report_status: "reported", quality: "valid", ...extra });
const hora = (t, cambios = {}) => [
  obs("hr", cambios.hr ?? 72, t), obs("rr", 16, t), obs("spo2", 98, t), obs("sbp", 120, t),
  obs("temp", 36.8, t), obs("consciousness", cambios.conciencia ?? "alert", t), obs("on_oxygen", false, t),
];

test("forma de la API real (payload) y de la falsa (directa) se agrupan igual", () => {
  const directa = [...hora(T1), ...hora(T0)];
  const real = directa.map((o) => ({ observation_id: "x", status_at: new Date(o.status_at), payload: o }));
  assert.deepEqual(agruparPorHora(real), agruparPorHora(directa));
});

test("ordena de la hora más antigua a la más reciente y evalúa cada una", () => {
  const filas = [...hora(T1, { conciencia: "voice" }), ...hora(T0)]; // llegan de la más reciente a la más antigua
  const r = evaluarHistorial(filas);
  assert.equal(r.length, 2);
  assert.equal(r[0].momento, T0);
  assert.equal(r[0].nivel, null);
  assert.equal(r[1].nivel, "PRIORITY");
  assert.equal(r[1].regla, "R03");
});

test("una hora con un dato pendiente queda INSUFFICIENT DATA, no se mezcla con otra hora", () => {
  const h = hora(T0).map((o) => (o.parameter === "spo2" ? { ...o, value: null, report_status: "pending" } : o));
  const r = evaluarHistorial([...h, ...hora(T1)]);
  assert.equal(r[0].nivel, "INSUFFICIENT DATA");
  assert.deepEqual(r[0].faltan, ["spo2"]);
  assert.equal(r[1].nivel, null);
});
