// cli.mjs — Puerta de entrada al motor oficial para otros programas (D.13).
// Lee JSON por la entrada estándar y escribe el resultado del motor en JSON.
//   {"observaciones": [...]}  -> observaciones del CONTRATO_INGESTA_V1
//   {"vitals": {...}}         -> un registro horario del generador (vitals.json)
// Código de salida 2 si la entrada no es válida. Reglas en BORRADOR.

import { evaluar, evaluarVitales, MOTOR_VERSION } from "./evaluar.mjs";
import { desdeGenerador } from "./desde-generador.mjs";
import { pathToFileURL } from "node:url";

export function evaluarEntrada(entrada) {
  if (entrada && Array.isArray(entrada.observaciones)) return evaluar(entrada.observaciones);
  if (entrada && entrada.vitals && typeof entrada.vitals === "object") {
    const { v, context } = desdeGenerador(entrada.vitals);
    return evaluarVitales(v, context);
  }
  throw new Error('Entrada inválida: se espera {"observaciones": [...]} o {"vitals": {...}}.');
}

async function leerEntrada() {
  const partes = [];
  for await (const parte of process.stdin) partes.push(parte);
  return JSON.parse(Buffer.concat(partes).toString("utf8"));
}

// Solo se ejecuta como programa, no cuando las pruebas lo importan.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const resultado = evaluarEntrada(await leerEntrada());
    process.stdout.write(JSON.stringify({ motor: "motor/evaluar.mjs", version: MOTOR_VERSION, ...resultado }));
  } catch (error) {
    process.stderr.write(String(error?.message ?? error));
    process.exitCode = 2;
  }
}
