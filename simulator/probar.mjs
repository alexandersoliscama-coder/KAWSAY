import fs from "node:fs";
import { cargarVitals, filtrar } from "./source.mjs";
import { medidoEn, estadoEn } from "./clock.mjs";

const config = JSON.parse(fs.readFileSync("simulator/config.json", "utf-8"));
const regs = cargarVitals(config.rutaVitals);
console.log("Total:", regs.length);
console.log("Ana días 0-6:", filtrar(regs, "A", 0, 6).length);
console.log("Día 29 hora 23:", medidoEn(config.inicioMision, 29, 23));
console.log("Estado de d0h0:", estadoEn(medidoEn(config.inicioMision, 0, 0)));