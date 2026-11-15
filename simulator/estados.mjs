// estados.mjs — Estados de los equipos (contrato de ingesta, sección "Estados").
// Convierte una lectura normal en: esperando, sin reporte, sin medio o inválida.

export function aplicarEstado(obs, estado, motivo) {
  const nueva = { ...obs };               // copia: la original no se modifica
  if (estado === "medible") return nueva;
  if (!motivo) throw new Error(`El estado "${estado}" necesita un motivo`);
  nueva.reason = motivo;

  if (estado === "invalida") {            // conserva valor y hora
    nueva.quality = "invalid";
    return nueva;
  }

  nueva.value = null;                     // los demás estados: sin lectura
  nueva.measured_at = null;
  nueva.quality = "unknown";
  if (estado === "esperando") {
    nueva.report_status = "pending";
  } else if (estado === "sin_reporte") {
    nueva.report_status = "not_reporting";
  } else if (estado === "sin_medio") {
    nueva.availability = "not_measurable";
    nueva.report_status = "not_applicable";
  } else {
    throw new Error(`Estado desconocido: ${estado}`);
  }
  return nueva;
}