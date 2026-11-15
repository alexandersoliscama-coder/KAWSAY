// probar-fallos.mjs — Manda paquetes ROTOS a propósito y comprueba que la API los rechace
// con un error comprensible (y que nada roto se guarde ni se reintente).
// Uso: con la API encendida, node simulator/probar-fallos.mjs
import { cargarVitals, cargarConfig } from "./source.mjs";
import { paqueteDeHora } from "./packet.mjs";
import { enviarPaquete } from "./transport.mjs";

const opciones = {
  base: process.env.KAWSAY_API_URL ?? "http://127.0.0.1:8781",
  token: process.env.KAWSAY_INGEST_TOKEN,
};
if (!opciones.token) throw new Error("Falta KAWSAY_INGEST_TOKEN en esta terminal.");

const config = cargarConfig();
const registros = cargarVitals(config.rutaVitals);
// Día 29 hora 23: una hora que las otras pruebas no usan.
const base = () => paqueteDeHora(registros, config, ["A", "B"], 29, 23);
const primera = (p) => p.subjects[0].observations[0]; // la FC de A

const casos = [
  { nombre: "Unidad incorrecta (FC en 'lpm')", esperado: "rechazado",
    romper: (p) => { primera(p).unit = "lpm"; } },
  { nombre: "Dato incompleto (reported sin valor)", esperado: "rechazado",
    romper: (p) => { primera(p).value = null; } },
  { nombre: "Campo faltante (sin status_at)", esperado: "rechazado",
    romper: (p) => { delete primera(p).status_at; } },
  { nombre: "ID equivocado (tripulante inexistente)", esperado: "rechazado",
    romper: (p) => { p.subjects[0].crew_member_id = "GEN-MEMBER-Z"; } },
  { nombre: "Persona repetida en el grupo", esperado: "rechazado",
    romper: (p) => { p.subjects[1] = structuredClone(p.subjects[0]); } },
  { nombre: "Token equivocado", esperado: "sin_permiso",
    romper: () => {}, token: "token-equivocado" },
  { nombre: "Paquete correcto", esperado: ["aceptado", "duplicado"], // duplicado si ya lo corriste antes
    romper: () => {} },
  { nombre: "Mismo ID, contenido cambiado", esperado: "conflicto",
    romper: (p) => { primera(p).value = 999; } },
];

let fallas = 0;
for (const caso of casos) {
  const paquete = base();
  caso.romper(paquete);
  const r = await enviarPaquete(paquete, caso.token ? { ...opciones, token: caso.token } : opciones);
  const esperados = [caso.esperado].flat();
  const ok = esperados.includes(r.resultado) && !r.reintentar;
  if (!ok) fallas++;
  console.log(`${ok ? "✅" : "❌"} ${caso.nombre}`);
  console.log(`     esperado: ${esperados.join(" o ")} | obtenido: ${r.resultado} (${r.codigo ?? "sin código"})`);
  console.log(`     mensaje: ${r.mensaje}${r.detalle ? "\n     detalle: " + r.detalle : ""}`);
}
console.log(fallas ? `\n${fallas} caso(s) no salieron como se esperaba.` : "\nTodos los fallos se detectaron con un mensaje comprensible.");
console.log("(Reintentos y cortes se prueban con probar-transporte.mjs y probar-outbox.mjs.)");
process.exitCode = fallas ? 1 : 0;
