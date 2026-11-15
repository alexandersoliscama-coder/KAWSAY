import { build } from "esbuild";
import { fileURLToPath } from "node:url";
await build({entryPoints:["start","demo","database","import-generated"].map(name=>fileURLToPath(new URL(`../server/${name}.ts`,import.meta.url))),
  bundle:true,platform:"node",format:"esm",target:"node24",packages:"external",
  outdir:fileURLToPath(new URL("../.api-dist/",import.meta.url)),outExtension:{".js":".mjs"}});
console.log("Built local ingestion API.");
