// probar-outbox.mjs — Demuestra "conservar pendientes durante un corte y reenviarlas".
//
//   node simulator/probar-outbox.mjs enviar 2 5   → envía el grupo de las horas 2 a 5 del día 0
//   node simulator/probar-outbox.mjs ver          → muestra qué quedó pendiente
//   node simulator/probar-outbox.mjs vaciar       → reenvía los pendientes
import path from "node:path";
import { cargarVitals, cargarConfig } from "./source.mjs";
import { paqueteDeHora } from "./packet.mjs";
import { enviarOGuardar, vaciarOutbox, listarPendientes } from "./outbox.mjs";

const opciones = {
  base: process.env.KAWSAY_API_URL ?? "http://127.0.0.1:8781",
  token: process.env.KAWSAY_INGEST_TOKEN,
};
if (!opciones.token) throw new Error("Falta KAWSAY_INGEST_TOKEN en esta terminal.");

const [accion, desde = "2", hasta = desde] = process.argv.slice(2);
const mostrarPendientes = () => {
  const lista = listarPendientes();
  console.log(`Pendientes en la outbox: ${lista.length}`);
  for (const ruta of lista) console.log("  -", path.basename(ruta));
};

if (accion === "enviar") {
  const config = cargarConfig();
  const registros = cargarVitals(config.rutaVitals);
  for (let hora = Number(desde); hora <= Number(hasta); hora++) {
    const paquete = paqueteDeHora(registros, config, ["A", "B", "C", "D"], 0, hora);
    const r = await enviarOGuardar(paquete, opciones);
    console.log(`Hora ${hora} (${paquete.message_id}) → ${r.resultado}: ${r.mensaje}`);
  }
  mostrarPendientes();
} else if (accion === "vaciar") {
  const r = await vaciarOutbox(opciones);
  console.log(`Enviados: ${r.enviados} | ya estaban: ${r.duplicados} | apartados por error: ${r.apartados} | siguen pendientes: ${r.quedan}`);
  mostrarPendientes();
} else if (accion === "ver") {
  mostrarPendientes();
} else {
  console.log("Uso: node simulator/probar-outbox.mjs enviar <horaDesde> <horaHasta> | vaciar | ver");
}
