// simular.mjs — Programa principal: recorre las horas del generador y las envía a la API.
//
//   node simulator/simular.mjs                       → día 0, horas 0-23, en grupo, acelerado (1 h simulada por segundo)
//   node simulator/simular.mjs --dias 0-6 --modo individual
//   node simulator/simular.mjs --horas 0-3 --velocidad 1   → velocidad NORMAL (1 h simulada = 1 h real)
//
// La velocidad solo cambia CADA CUÁNTO se envía. La hora de medición (measured_at)
// y el identificador de ejecución (SIM-01) NO cambian (D.06, D.10).
// Si la API no responde, los paquetes quedan en simulator/outbox/ y se reenvían solos.
// Ctrl+C detiene la simulación; lo pendiente sigue guardado.
import { cargarVitals, cargarConfig } from "./source.mjs";
import { paqueteDeHora } from "./packet.mjs";
import { enviarOGuardar, listarPendientes } from "./outbox.mjs";

const SEGUNDOS_POR_HORA = 3600;
const ASTROS = ["A", "B", "C", "D"];

function leerArgumentos(lista) {
  const valores = { dias: "0-0", horas: "0-23", modo: "grupo", velocidad: "3600" };
  for (let i = 0; i < lista.length; i += 2) {
    const nombre = lista[i].replace(/^--/, "");
    if (!(nombre in valores)) throw new Error(`Opción desconocida: ${lista[i]}`);
    valores[nombre] = lista[i + 1];
  }
  const rango = (texto) => { const [a, b = a] = texto.split("-").map(Number); return [a, b]; };
  const velocidad = Number(valores.velocidad);
  if (!["grupo", "individual"].includes(valores.modo)) throw new Error("--modo debe ser grupo o individual");
  if (!(velocidad > 0)) throw new Error("--velocidad debe ser un número mayor que 0");
  return { dias: rango(valores.dias), horas: rango(valores.horas), modo: valores.modo, velocidad };
}

const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));

const opciones = {
  base: process.env.KAWSAY_API_URL ?? "http://127.0.0.1:8781",
  token: process.env.KAWSAY_INGEST_TOKEN,
};
if (!opciones.token) throw new Error("Falta KAWSAY_INGEST_TOKEN en esta terminal.");

const { dias, horas, modo, velocidad } = leerArgumentos(process.argv.slice(2));
const config = cargarConfig();
const registros = cargarVitals(config.rutaVitals);
const msPorHoraSimulada = (SEGUNDOS_POR_HORA / velocidad) * 1000;

console.log(`Ejecución ${config.simulationRunId} → ${opciones.base}`);
console.log(`Días ${dias.join("-")}, horas ${horas.join("-")}, modo ${modo}, velocidad x${velocidad} (${msPorHoraSimulada / 1000} s reales por hora simulada)`);
if (listarPendientes().length) console.log(`Hay ${listarPendientes().length} pendiente(s) de antes: se reenviarán primero.`);

const conteo = {};
for (let dia = dias[0]; dia <= dias[1]; dia++)
  for (let hora = horas[0]; hora <= horas[1]; hora++) {
    const inicio = Date.now();
    const grupos = modo === "grupo" ? [ASTROS] : ASTROS.map((a) => [a]);
    for (const astros of grupos) {
      const paquete = paqueteDeHora(registros, config, astros, dia, hora);
      const r = await enviarOGuardar(paquete, opciones);
      conteo[r.resultado] = (conteo[r.resultado] ?? 0) + 1;
      const medido = paquete.subjects[0].observations[0].measured_at;
      console.log(`d${dia}h${hora} [medido ${medido}] ${astros.join("")} → ${r.resultado}${r.resultado === "aceptado" || r.resultado === "duplicado" ? "" : ": " + r.mensaje}`);
    }
    await esperar(Math.max(0, msPorHoraSimulada - (Date.now() - inicio)));
  }

console.log("Resumen:", conteo, `| pendientes en outbox: ${listarPendientes().length}`);
