// clock.mjs — Reloj de simulación.
// Convierte el (día, hora) del generador en fechas ISO del contrato.

const MS_POR_SEGUNDO = 1000;
const MS_POR_HORA = 3600 * MS_POR_SEGUNDO;
const HORAS_POR_DIA = 24;

// Momento de la medición: inicio de misión + días y horas transcurridos.
export function medidoEn(inicioISO, dia, hora) {
  const horasDesdeInicio = dia * HORAS_POR_DIA + hora;
  const ms = Date.parse(inicioISO) + horasDesdeInicio * MS_POR_HORA;
  return new Date(ms).toISOString();
}

// Momento en que se comunica el estado: 1 s después de medir.
// Es fijo (no usa la hora actual) para que un reenvío produzca el mismo paquete.
export function estadoEn(medidoISO) {
  return new Date(Date.parse(medidoISO) + MS_POR_SEGUNDO).toISOString();
}
