// ids.mjs — Identificadores fijos del simulador.
// Los IDs se construyen a partir de lo que identifica al dato (ejecución, persona, día, hora,
// variable). Así, reenviar el mismo dato produce el mismo ID y la API lo reconoce como duplicado.

function dosDigitos(numero) {
  return String(numero).padStart(2, "0");
}

function marcaDeTiempo(dia, hora) {
  return `d${dosDigitos(dia)}h${dosDigitos(hora)}`;
}

// Ej.: SIM-01-GEN-MEMBER-A-d00h00-hr
export function idObservacion(runId, memberId, dia, hora, parametro) {
  return `${runId}-${memberId}-${marcaDeTiempo(dia, hora)}-${parametro}`;
}

// Ej.: SIM-01-msg-ABCD-d00h00
export function idMensaje(runId, astros, dia, hora) {
  return `${runId}-msg-${astros.join("")}-${marcaDeTiempo(dia, hora)}`;
}
