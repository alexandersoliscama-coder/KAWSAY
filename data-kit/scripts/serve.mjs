import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extname, resolve, sep } from "node:path";
const root = fileURLToPath(new URL("../dist/", import.meta.url));
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const path = resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!path.startsWith(resolve(root) + sep)) { response.writeHead(403).end(); return; }
    const data = await readFile(path);
    response.writeHead(200, { "Content-Type": mime[extname(path)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    response.end(data);
  } catch { response.writeHead(404).end("Not found. Run npm run build first."); }
});
server.listen(Number(process.env.PORT ?? 4173), "127.0.0.1", () => console.log(`Data preview: http://127.0.0.1:${server.address().port}`));
