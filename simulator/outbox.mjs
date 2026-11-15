// outbox.mjs — Bandeja de salida: guarda en disco lo que no se pudo enviar.
//
// Idea: un paquete NUNCA se pierde. Si la API no responde (corte o 503),
// se guarda como archivo en simulator/outbox/ y se reenvía después,
// IDÉNTICO (mismos IDs). Si ya había llegado, la API dirá "duplicado" (200).
//
// Cada pendiente es un archivo <message_id>.json. Así se puede ver, contar
// y sobrevive aunque se cierre el programa o se apague la PC.
import fs from "node:fs";
import path from "node:path";
import { enviarConReintentos } from "./transport.mjs";

const CARPETA = process.env.KAWSAY_OUTBOX_DIR ?? path.join("simulator", "outbox");
const CARPETA_FALLIDOS = path.join(CARPETA, "fallidos");

function asegurarCarpetas() {
  fs.mkdirSync(CARPETA_FALLIDOS, { recursive: true });
}

export function guardarPendiente(paquete) {
  asegurarCarpetas();
  const destino = path.join(CARPETA, `${paquete.message_id}.json`);
  const temporal = `${destino}.tmp`;
  // Escribimos primero un temporal y luego lo renombramos: si se corta la luz
  // a la mitad, nunca queda un archivo a medio escribir con el nombre bueno.
  fs.writeFileSync(temporal, JSON.stringify(paquete, null, 2));
  fs.renameSync(temporal, destino);
}

export function listarPendientes() {
  if (!fs.existsSync(CARPETA)) return [];
  return fs.readdirSync(CARPETA)
    .filter((nombre) => nombre.endsWith(".json"))
    .sort() // los message_id llevan dXXhYY, así que el orden alfabético = orden en el tiempo
    .map((nombre) => path.join(CARPETA, nombre));
}

function apartarFallido(ruta, resultado) {
  // Un 409 o 422 no se arregla reintentando: lo apartamos con su motivo
  // para que una persona lo revise, y no bloquea a los demás.
  asegurarCarpetas();
  const nombre = path.basename(ruta);
  fs.renameSync(ruta, path.join(CARPETA_FALLIDOS, nombre));
  fs.writeFileSync(path.join(CARPETA_FALLIDOS, nombre.replace(".json", ".motivo.txt")),
    `${resultado.resultado} (${resultado.codigo}): ${resultado.mensaje}\n${resultado.detalle ?? ""}\n`);
}

// Reenvía los pendientes en orden. Se detiene en cuanto la API vuelve a fallar
// (no tiene sentido seguir golpeando una API caída).
export async function vaciarOutbox(opciones, ajustes = {}) {
  const resumen = { enviados: 0, duplicados: 0, apartados: 0, quedan: 0 };
  const pendientes = listarPendientes();
  for (let i = 0; i < pendientes.length; i++) {
    const ruta = pendientes[i];
    const paquete = JSON.parse(fs.readFileSync(ruta, "utf8"));
    const r = await enviarConReintentos(paquete, opciones, ajustes);
    if (r.resultado === "aceptado" || r.resultado === "duplicado") {
      fs.unlinkSync(ruta); // llegó: ya no está pendiente
      r.resultado === "aceptado" ? resumen.enviados++ : resumen.duplicados++;
    } else if (r.reintentar) {
      resumen.quedan = pendientes.length - i; // la API sigue caída: se quedan todos
      break;
    } else {
      apartarFallido(ruta, r);
      resumen.apartados++;
    }
  }
  return resumen;
}

// Envío normal: primero los pendientes viejos (para respetar el orden), luego el nuevo.
// Si la API no responde, el nuevo queda guardado. Si ya había cola, ni lo intenta: se forma.
export async function enviarOGuardar(paquete, opciones, ajustes = {}) {
  if (listarPendientes().length > 0) {
    const resumen = await vaciarOutbox(opciones, ajustes);
    if (resumen.quedan > 0) {
      guardarPendiente(paquete);
      return { resultado: "pendiente", mensaje: "La API sigue sin responder; se guardó en la outbox." };
    }
  }
  const r = await enviarConReintentos(paquete, opciones, ajustes);
  if (r.reintentar) {
    guardarPendiente(paquete);
    return { ...r, resultado: "pendiente", mensaje: `${r.mensaje} Se guardó en la outbox.` };
  }
  return r;
}
