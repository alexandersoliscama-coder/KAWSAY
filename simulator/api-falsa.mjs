// api-falsa.mjs — API FALSA (mock) para probar el simulador sin la API de Bryan.
//
// Imita SOLO lo que Bryan nos dijo de su API:
//   POST /api/v1/observations  (requiere "Authorization: Bearer <token>")
//     201 paquete nuevo · 200 con duplicate=true si llega igual otra vez
//     409 mismo ID con otro contenido · 400 JSON roto · 413 muy grande
//     415 no es JSON · 401 sin token · 422 no cumple el contrato · 503 corte
//   GET /api/v1/crew-members/{id}/observations?clock_key=simulation:SIM-01&limit=50
//
// Valida con reglas-contrato.mjs (lo escrito en el contrato) y solo conoce a los
// tripulantes de simulator/config.json, como si fueran los registrados en la base.
// NO es el validador real (parseIngestion) ni guarda en SQL: todo vive en memoria
// y se borra al cerrarla. La forma de los cuerpos JSON es una suposición nuestra;
// cuando llegue la API de Bryan, manda la suya.
//
// Uso:  node simulator/api-falsa.mjs           → responde normal
//       node simulator/api-falsa.mjs --corte   → responde 503 a todo (simula caída)
import http from "node:http";
import { cargarConfig } from "./source.mjs";
import { erroresDelPaquete } from "./reglas-contrato.mjs";

const PUERTO = Number(process.env.KAWSAY_MOCK_PORT ?? 8781); // 8781: no choca con la real (8780)
const TOKEN = process.env.KAWSAY_INGEST_TOKEN;
const MODO_CORTE = process.argv.includes("--corte");
const MAX_BYTES = 1_000_000;
const RUTA_HISTORIAL = /^\/api\/v1\/crew-members\/([^/]+)\/observations$/;

if (!TOKEN) {
  console.error("Falta KAWSAY_INGEST_TOKEN. En PowerShell: $env:KAWSAY_INGEST_TOKEN = \"solo-mock-local\"");
  process.exit(1);
}

const config = cargarConfig();
const miembrosConocidos = new Set(Object.values(config.tripulantes).map((t) => t.crew_member_id));

const mensajes = new Map();      // message_id     → texto exacto recibido
const observaciones = new Map(); // observation_id → { texto, registro guardado }

function responder(res, codigo, cuerpo) {
  res.writeHead(codigo, { "content-type": "application/json" });
  res.end(JSON.stringify(cuerpo));
}

function tokenCorrecto(req) {
  return req.headers.authorization === `Bearer ${TOKEN}`; // nunca imprimimos el token
}

function leerCuerpo(req) {
  return new Promise((resolver, rechazar) => {
    let texto = "";
    req.on("data", (trozo) => {
      texto += trozo;
      if (texto.length > MAX_BYTES) rechazar(new Error("muy grande"));
    });
    req.on("end", () => resolver(texto));
    req.on("error", rechazar);
  });
}

async function recibirPaquete(req, res) {
  if (!(req.headers["content-type"] ?? "").startsWith("application/json"))
    return responder(res, 415, { error: "unsupported_media_type", message: "Envía Content-Type: application/json" });

  let texto;
  try { texto = await leerCuerpo(req); }
  catch { return responder(res, 413, { error: "payload_too_large", message: `Máximo ${MAX_BYTES} bytes` }); }

  let paquete;
  try { paquete = JSON.parse(texto); }
  catch { return responder(res, 400, { error: "invalid_json", message: "El cuerpo no es JSON válido" }); }

  const errores = erroresDelPaquete(paquete, { miembrosConocidos });
  if (errores.length)
    return responder(res, 422, { error: "invalid_contract", message: errores[0], errors: errores.slice(0, 20) });

  const canon = JSON.stringify(paquete);
  const anterior = mensajes.get(paquete.message_id);
  if (anterior === canon)
    return responder(res, 200, { status: "accepted", duplicate: true, message_id: paquete.message_id });
  if (anterior !== undefined)
    return responder(res, 409, { error: "conflict", message: `message_id ${paquete.message_id} ya existe con otro contenido` });

  // Revisamos TODO antes de guardar nada (como una transacción).
  for (const persona of paquete.subjects)
    for (const obs of persona.observations ?? []) {
      const previa = observaciones.get(obs.observation_id);
      if (previa && previa.texto !== JSON.stringify(obs))
        return responder(res, 409, { error: "conflict", message: `observation_id ${obs.observation_id} ya existe con otro contenido` });
    }

  const recibido = new Date().toISOString(); // el servidor añade received_at
  const clave = `${paquete.clock?.mode}:${paquete.clock?.simulation_run_id}`;
  let nuevas = 0;
  for (const persona of paquete.subjects)
    for (const obs of persona.observations ?? []) {
      if (observaciones.has(obs.observation_id)) continue;
      observaciones.set(obs.observation_id, {
        texto: JSON.stringify(obs),
        registro: { ...obs, crew_member_id: persona.crew_member_id, clock_key: clave, received_at: recibido },
      });
      nuevas++;
    }
  mensajes.set(paquete.message_id, canon);
  return responder(res, 201, { status: "accepted", duplicate: false, message_id: paquete.message_id, observations_stored: nuevas });
}

function historial(res, memberId, url) {
  const clave = url.searchParams.get("clock_key");
  const limite = Number(url.searchParams.get("limit") ?? 50);
  const lista = [...observaciones.values()]
    .map((o) => o.registro)
    .filter((r) => r.crew_member_id === memberId && (!clave || r.clock_key === clave))
    .sort((a, b) => String(b.measured_at ?? b.status_at).localeCompare(String(a.measured_at ?? a.status_at)))
    .slice(0, limite);
  return responder(res, 200, { crew_member_id: memberId, observations: lista });
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PUERTO}`);
  const fin = (codigo) => console.log(`${req.method} ${url.pathname} → ${codigo}`);
  res.on("finish", () => fin(res.statusCode));

  if (MODO_CORTE) return responder(res, 503, { error: "unavailable", message: "Modo corte activado" });
  if (!tokenCorrecto(req)) return responder(res, 401, { error: "unauthorized", message: "Token ausente o incorrecto" });

  if (req.method === "POST" && url.pathname === "/api/v1/observations") return recibirPaquete(req, res);
  const coincide = url.pathname.match(RUTA_HISTORIAL);
  if (req.method === "GET" && coincide) return historial(res, decodeURIComponent(coincide[1]), url);
  return responder(res, 404, { error: "not_found" });
});

servidor.listen(PUERTO, "127.0.0.1", () => {
  console.log(`API FALSA escuchando en http://127.0.0.1:${PUERTO}${MODO_CORTE ? "  (MODO CORTE: todo 503)" : ""}`);
});
