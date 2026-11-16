import { build } from "esbuild";
import { mkdir, copyFile, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const output = new URL("../dist/", import.meta.url);
await import('./build-simulator.mjs');
await mkdir(new URL("data/", output), { recursive: true });
await copyFile(new URL('../demo/kawsay-simulador.html', import.meta.url), new URL('kawsay-simulador.html', output));
for (const name of ["crew", "vitals", "daily", "environment", "manifest"]) {
  await copyFile(new URL(`../../app/public/data/${name}.json`, import.meta.url), new URL(`data/${name}.json`, output));
}
await build({ entryPoints: [fileURLToPath(new URL("../demo/main.tsx", import.meta.url))],
  bundle: true, minify: true, target: "es2022", format: "esm", jsx: "automatic",
  outfile: fileURLToPath(new URL("app.js", output)) });
await writeFile(new URL("index.html", output), `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KAWSAY · Datos y generador</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`);
for (const name of ["manifest.webmanifest", "icon.svg"]) {
  await copyFile(new URL(`../demo/${name}`, import.meta.url), new URL(name, output));
}
await writeFile(new URL("index.html", output), '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#102e3b"><link rel="manifest" href="/manifest.webmanifest"><title>KAWSAY · Salud en misión</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
// Keep the existing data/LLM dashboard accessible while serving the approved UI.
await copyFile(new URL("index.html", output), new URL("monitor.html", output));
// Motor NEWS2 (borrador) para el navegador: misma función evaluar() que usan las pruebas de motor/.
// Solo se sustituye engine-adapter.mjs (usa módulos de Node y no interviene en news2/evaluar).
const sinAdaptadorNode = { name: "sin-adaptador-node", setup(b) {
  b.onResolve({ filter: /engine-adapter\.mjs$/ }, () => ({ path: "engine-adapter-stub", namespace: "stub" }));
  b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: 'export const evaluate=()=>{throw new Error("No disponible en el navegador")};', loader: "js" }));
} };
await build({ entryPoints: [fileURLToPath(new URL("../../motor/navegador.mjs", import.meta.url))],
  bundle: true, minify: true, target: "es2022", format: "iife", globalName: "KAWSAY_ENGINE", platform: "browser",
  plugins: [sinAdaptadorNode], outfile: fileURLToPath(new URL("engine.js", output)) });
await copyFile(new URL("../../KAWSAY-interfaces.html", import.meta.url), new URL("index.html", output));
await copyFile(new URL("../../KAWSAY-interfaces.html", import.meta.url), new URL("KAWSAY-interfaces.html", output));
const hash = createHash("sha256");
for (const asset of ["app.js","app.css","index.html","data/manifest.json","manifest.webmanifest","icon.svg"]) hash.update(await readFile(new URL(asset, output)));
const worker = await readFile(new URL("../demo/sw.js",import.meta.url),"utf8");
await writeFile(new URL("sw.js",output), worker.replace("__BUILD__",hash.digest("hex").slice(0,16)));
console.log("Built KAWSAY dashboard, reference catalog and static offline shell.");
await copyFile(new URL("../demo/pruebas.html",import.meta.url),new URL("pruebas.html",output));
await mkdir(new URL("examples/",output),{recursive:true});
for(const name of ["individual","group"])await copyFile(new URL(`../../contracts/examples/${name}.json`,import.meta.url),new URL(`examples/${name}.json`,output));
