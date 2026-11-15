// Compile the shared migration implementation so the CLI and local demo stay aligned.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
const target=new URL("../.api-dist/database.mjs",import.meta.url);
await build({entryPoints:[fileURLToPath(new URL("../server/database.ts",import.meta.url))],
  bundle:true,platform:"node",format:"esm",target:"node24",packages:"external",outfile:fileURLToPath(target)});
await import(target.href);
