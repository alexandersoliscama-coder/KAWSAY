// transport.mjs — Envía paquetes a la API y traduce sus respuestas.
//
// Regla de oro (contrato): un reintento manda EXACTAMENTE el mismo paquete,
// con los mismos IDs. Así la API puede reconocerlo como duplicado (200)
// en vez de guardarlo dos veces.

const ESPERA_MAX_MS = 5000; // si la API no contesta en 5 s, lo tratamos como corte

// Qué significa cada código y si vale la pena reintentar.
export function clasificar(codigo) {
  if (codigo === 201) return { resultado: "aceptado", reintentar: false, mensaje: "Paquete guardado." };
  if (codigo === 200) return { resultado: "duplicado", reintentar: false, mensaje: "La API ya lo tenía; no se guardó dos veces." };
  if (codigo === 409) return { resultado: "conflicto", reintentar: false, mensaje: "Ese ID ya existe con otro contenido. Revisa el simulador; reintentar no lo arregla." };
  if (codigo === 401 || codigo === 403) return { resultado: "sin_permiso", reintentar: false, mensaje: "Token ausente o incorrecto. Revisa KAWSAY_INGEST_TOKEN." };
  if ([400, 413, 415, 422].includes(codigo)) return { resultado: "rechazado", reintentar: false, mensaje: "La API rechazó el formato del paquete. Corrígelo antes de reenviar." };
  if (codigo === 503) return { resultado: "no_disponible", reintentar: true, mensaje: "La API no está disponible por ahora." };
  return { resultado: "desconocido", reintentar: false, mensaje: `Respuesta inesperada (${codigo}).` };
}

// Un solo intento. Nunca lanza error: siempre devuelve un resultado legible.
export async function enviarPaquete(paquete, { base, token, fetchImpl = globalThis.fetch }) {
  try {
    const res = await fetchImpl(`${base}/api/v1/observations`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(paquete),
      signal: AbortSignal.timeout(ESPERA_MAX_MS),
    });
    const cuerpo = await res.json().catch(() => null);
    return { codigo: res.status, ...clasificar(res.status), detalle: cuerpo?.message ?? null };
  } catch (error) {
    // Sin respuesta: API apagada, cable desconectado o demasiado lenta.
    return { codigo: null, resultado: "sin_conexion", reintentar: true, mensaje: "No hubo respuesta de la API (corte o API apagada).", detalle: error.cause?.code ?? error.name };
  }
}

const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));

// Reintenta solo cuando tiene sentido, esperando cada vez el doble (0.5 s, 1 s, 2 s…).
export async function enviarConReintentos(paquete, opciones, { intentos = 4, esperaInicialMs = 500, alReintentar } = {}) {
  let resultado;
  for (let intento = 1; intento <= intentos; intento++) {
    resultado = await enviarPaquete(paquete, opciones);
    resultado.intentos = intento;
    if (!resultado.reintentar || intento === intentos) break;
    const espera = esperaInicialMs * 2 ** (intento - 1);
    alReintentar?.(intento, espera, resultado);
    await esperar(espera);
  }
  return resultado; // si reintentar sigue en true, el paquete queda PENDIENTE (lo guardará la outbox)
}

export async function leerHistorial(memberId, { base, token, fetchImpl = globalThis.fetch }, clockKey = "simulation:SIM-01", limite = 50) {
  const url = `${base}/api/v1/crew-members/${encodeURIComponent(memberId)}/observations?clock_key=${encodeURIComponent(clockKey)}&limit=${limite}`;
  let res;
  try {
    res = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(ESPERA_MAX_MS) });
  } catch {
    throw new Error("Historial no disponible: no hubo respuesta de la API (corte o API apagada).");
  }
  if (!res.ok) throw new Error(`Historial no disponible: ${clasificar(res.status).mensaje}`);
  return (await res.json()).observations;
}
