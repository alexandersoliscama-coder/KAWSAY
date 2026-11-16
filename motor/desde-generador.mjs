// desde-generador.mjs — Traduce un registro horario del generador (vitals.json)
// al formato que pide news2(v, context). Lo usa el monitor IA (D.13).
// Un campo ausente, null o no finito queda AUSENTE: nunca se rellena.

const NUMERICOS = ["hr", "rr", "spo2", "sbp", "temp"];

export function desdeGenerador(registro) {
  const v = {};
  const context = { scale: 1 }; // Igual que desdeContrato: escala 1 de SpO2.
  if (!registro || typeof registro !== "object") return { v, context };

  for (const campo of NUMERICOS) {
    const valor = registro[campo];
    if (typeof valor === "number" && Number.isFinite(valor)) v[campo] = valor;
  }
  if (typeof registro.alert === "boolean") context.alert = registro.alert;
  if (typeof registro.on_oxygen === "boolean") context.onOxygen = registro.on_oxygen;
  return { v, context };
}
