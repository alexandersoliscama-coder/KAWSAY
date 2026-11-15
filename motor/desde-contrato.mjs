// desde-contrato.mjs — Traduce observaciones del CONTRATO_INGESTA_V1
// al formato que pide news2(v, context) de Bryan.

const NUMERICOS = ["hr", "rr", "spo2", "sbp", "temp"]; // dbp no entra en NEWS2

export function desdeContrato(observaciones) {
  const v = {};
  const context = { scale: 1 };

  for (const o of observaciones) {
    // 1. Filtro de confianza: solo cuenta lo recibido Y válido.
    if (o.report_status !== "reported" || o.quality !== "valid") continue;

    // 2. Signos numéricos: se copian tal cual a v.
    if (NUMERICOS.includes(o.parameter)) v[o.parameter] = o.value;

    // 3. Conciencia (ACVPU): solo "alert" es alerta; voice/pain/etc. no.
    if (o.parameter === "consciousness") context.alert = (o.value === "alert");

    // 4. Oxígeno suplementario: true/false directo.
    if (o.parameter === "on_oxygen") context.onOxygen = o.value;
  }
  return { v, context };
}
