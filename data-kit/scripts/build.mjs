import { build } from "esbuild";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const output = new URL("../dist/", import.meta.url);
await mkdir(new URL("data/", output), { recursive: true });
for (const name of ["crew", "vitals", "daily", "environment", "manifest"]) {
  await copyFile(new URL(`../../app/public/data/${name}.json`, import.meta.url), new URL(`data/${name}.json`, output));
}
await build({ entryPoints: [fileURLToPath(new URL("../demo/main.tsx", import.meta.url))],
  bundle: true, minify: true, target: "es2022", format: "esm", jsx: "automatic",
  outfile: fileURLToPath(new URL("app.js", output)) });
await writeFile(new URL("index.html", output), `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KAWSAY · Datos y generador</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`);
console.log("Built data preview in data-kit/dist (no clinical engine, no service worker).");
