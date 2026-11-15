import { observacionLeida } from "./packet.mjs";
import { aplicarEstado } from "./estados.mjs";
const base = observacionLeida({ runId: "SIM-01", memberId: "GEN-MEMBER-B", deviceId: "SIM-SUIT-01",
  inicio: "2028-01-01T00:00:00Z", day: 3, hour: 10, parametro: "spo2", valor: 97 });

const casos = [
  ["medible", null],
  ["esperando", "Lectura solicitada, aún sin respuesta del equipo."],
  ["sin_reporte", "El oxímetro no envió datos en esta hora."],
  ["sin_medio", "Sin oxímetro disponible en el módulo."],
  ["invalida", "Señal con movimiento; lectura no confiable."]
];

for (const [estado, motivo] of casos) {
  const o = aplicarEstado(base, estado, motivo);
  console.log(estado.padEnd(12), "|", o.availability.padEnd(14), "|", o.report_status.padEnd(14),
    "|", o.quality.padEnd(7), "| value:", o.value, "| measured_at:", o.measured_at ? "sí" : "null");
}
console.log("Original intacta:", base.report_status, base.value);
