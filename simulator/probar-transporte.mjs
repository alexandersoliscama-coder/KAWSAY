// probar-transporte.mjs — Prueba transport.mjs contra la API (falsa o real).
// Uso: node simulator/probar-transporte.mjs
import { cargarVitals, cargarConfig } from "./source.mjs";
import { paqueteDeHora } from "./packet.mjs";
import { enviarConReintentos, leerHistorial } from "./transport.mjs";

const opciones = {
  base: process.env.KAWSAY_API_URL ?? "http://127.0.0.1:8781",
  token: process.env.KAWSAY_INGEST_TOKEN,
};
if (!opciones.token) throw new Error("Falta KAWSAY_INGEST_TOKEN en esta terminal.");

const config = cargarConfig();
const registros = cargarVitals(config.rutaVitals);
const paquete = paqueteDeHora(registros, config, ["A", "B", "C", "D"], 0, 1); // grupo, día 0 hora 1

const avisar = (n, ms, r) => console.log(`   intento ${n}: ${r.mensaje} Reintento en ${ms} ms…`);
const mostrar = (titulo, r) =>
  console.log(`${titulo} → ${r.resultado} (${r.codigo ?? "sin código"}, ${r.intentos} intento/s): ${r.mensaje}${r.detalle ? " | " + r.detalle : ""}`);

mostrar("1. Envío del grupo", await enviarConReintentos(paquete, opciones, { alReintentar: avisar }));
mostrar("2. Reenvío igual  ", await enviarConReintentos(paquete, opciones, { alReintentar: avisar }));

const alterado = structuredClone(paquete);
alterado.subjects[1].observations[0].value = 999;
mostrar("3. Mismo ID, otro valor", await enviarConReintentos(alterado, opciones));

try {
  for (const persona of paquete.subjects) {
    const hist = await leerHistorial(persona.crew_member_id, opciones);
    const ajenas = hist.filter((o) => o.crew_member_id !== persona.crew_member_id).length;
    console.log(`4. Historial ${persona.crew_member_id}: ${hist.length} observaciones, ajenas: ${ajenas}`);
  }
} catch (error) {
  console.log("4. Historial →", error.message);
}
