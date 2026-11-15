import { build } from "esbuild";
import { fileURLToPath } from "node:url";
await build({entryPoints:[fileURLToPath(new URL("../server/start.ts",import.meta.url)),fileURLToPath(new URL("../server/demo.ts",import.meta.url))],
  bundle:true,platform:"node",format:"esm",target:"node24",packages:"external",
  outdir:fileURLToPath(new URL("../.api-dist/",import.meta.url)),outExtension:{".js":".mjs"}});
console.log("Built local ingestion API.");
