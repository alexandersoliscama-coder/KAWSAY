// navegador.mjs — Punto de entrada para empaquetar el motor en el navegador (dist/engine.js).
// Expone window.KAWSAY_ENGINE.evaluar, la misma función que usan las pruebas del motor.
export { evaluar } from "./evaluar.mjs";
