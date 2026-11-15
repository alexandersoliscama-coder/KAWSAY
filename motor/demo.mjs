// demo.mjs — Lee el historial de un tripulante desde la API y muestra el nivel de cada hora.
// Uso (PowerShell, con la API corriendo en otra terminal):
//   Remove-Item Env:KAWSAY_INGEST_TOKEN -ErrorAction SilentlyContinue
//   node --env-file=data-kit/.env motor/demo.mjs GEN-MEMBER-A
// Reglas en BORRADOR: esto es una demostración técnica, no una recomendación clínica.

import { leerHistorial } from "../simulator/transport.mjs";
import { evaluarHistorial } from "./historial.mjs";

const miembro = process.argv[2];
const limite = Number(process.argv[3] ?? 80); // 80 = 10 horas × 8 observaciones
const opciones = {
  base: process.env.KAWSAY_API_URL ?? "http://127.0.0.1:8780",
  token: process.env.KAWSAY_INGEST_TOKEN,
};

if (!miembro) {
  console.error("Uso: node --env-file=data-kit/.env motor/demo.mjs GEN-MEMBER-A [limite]");
  process.exit(1);
}
if (!opciones.token) {
  console.error("Falta KAWSAY_INGEST_TOKEN (usa --env-file=data-kit/.env).");
  process.exit(1);
}

let filas;
try {
  filas = await leerHistorial(miembro, opciones, "simulation:SIM-01", limite);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

let resultados = evaluarHistorial(filas);
// La API corta por número de observaciones: si llegamos al límite, la hora más antigua
// puede venir incompleta. Se descarta para no mostrar un "INSUFFICIENT DATA" falso.
let aviso = "";
if (filas.length >= limite && resultados.length > 1) {
  resultados = resultados.slice(1);
  aviso = `(Se omitió la hora más antigua: pudo llegar incompleta por el límite de ${limite}. Sube el límite para ver más.)\n`;
}
console.log(`\nKAWSAY · Motor NEWS-2 (BORRADOR) · ${miembro} · ${resultados.length} hora/s desde ${opciones.base}\n`);
console.table(resultados.map((r) => ({
  hora: r.momento.slice(0, 16).replace("T", " "),
  NEWS2: r.news2.total ?? "—",
  "algún 3": r.news2.any3 === null ? "—" : r.news2.any3 ? "sí" : "no",
  nivel: r.nivel ?? "sin clasificar",
  regla: r.regla ?? "—",
  faltan: r.faltan?.join(", ") ?? "",
})));
if (aviso) console.log(aviso);
console.log("Reglas R01/R02/R03/R19 en borrador, pendientes de revisión clínica. Sin clasificar ≠ autocuidado.\n");
