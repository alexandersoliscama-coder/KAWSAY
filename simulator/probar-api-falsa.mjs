// probar-api-falsa.mjs — Manda un paquete a la API falsa y revisa sus respuestas.
// Antes: en otra terminal, node simulator/api-falsa.mjs
import { cargarVitals, cargarConfig } from "./source.mjs";
import { paqueteDeHora } from "./packet.mjs";

const BASE = process.env.KAWSAY_API_URL ?? "http://127.0.0.1:8781";
const TOKEN = process.env.KAWSAY_INGEST_TOKEN;

async function enviar(paquete, token = TOKEN) {
  const res = await fetch(`${BASE}/api/v1/observations`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(paquete),
  });
  return { codigo: res.status, cuerpo: await res.json() };
}

const config = cargarConfig();
const registros = cargarVitals(config.rutaVitals);
const paquete = paqueteDeHora(registros, config, ["A"], 0, 0);

const r1 = await enviar(paquete);
console.log("1. Primer envío         →", r1.codigo, r1.cuerpo);
const r2 = await enviar(paquete);
console.log("2. Mismo paquete otra vez →", r2.codigo, r2.cuerpo);

const alterado = structuredClone(paquete);
alterado.subjects[0].observations[0].value = 999;
const r3 = await enviar(alterado);
console.log("3. Mismo ID, otro valor →", r3.codigo, r3.cuerpo);

const r4 = await enviar(paquete, "token-equivocado");
console.log("4. Token equivocado     →", r4.codigo, r4.cuerpo);

const memberId = paquete.subjects[0].crew_member_id;
const res = await fetch(`${BASE}/api/v1/crew-members/${memberId}/observations?clock_key=simulation:SIM-01&limit=50`, {
  headers: { authorization: `Bearer ${TOKEN}` },
});
const hist = await res.json();
console.log("5. Historial de", memberId, "→", res.status, "| observaciones:", hist.observations.length);
console.log("   primera:", hist.observations.find((o) => o.parameter === "hr"));
