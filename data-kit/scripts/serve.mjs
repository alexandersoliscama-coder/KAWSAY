import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extname, resolve, sep } from "node:path";
const root = fileURLToPath(new URL("../dist/", import.meta.url));
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (["/api/monitor/state", "/api/monitor/demo", "/api/monitor/report"].includes(pathname)) {
      if (!["GET", "POST"].includes(request.method)) { response.writeHead(405).end(); return; }
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 1024) { response.writeHead(413).end(); return; }
        chunks.push(chunk);
      }
      try {
        const upstream = await fetch(`http://127.0.0.1:8765${pathname}`, {
          method: request.method,
          headers: { "Content-Type": "application/json", ...(request.headers.origin ? { Origin: request.headers.origin } : {}) },
          ...(request.method === "POST" ? { body: Buffer.concat(chunks) } : {}),
          signal: AbortSignal.timeout(5000),
        });
        response.writeHead(upstream.status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        response.end(await upstream.text());
      } catch {
        response.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "Servicio de monitoreo desconectado. Inicia python llm-service/service.py" }));
      }
      return;
    }
    const path = resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!path.startsWith(resolve(root) + sep)) { response.writeHead(403).end(); return; }
    const data = await readFile(path);
    response.writeHead(200, { "Content-Type": mime[extname(path)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    response.end(data);
  } catch { response.writeHead(404).end("Not found. Run npm run build first."); }
});
server.listen(Number(process.env.PORT ?? 4173), "127.0.0.1", () => console.log(`Data preview: http://127.0.0.1:${server.address().port}`));
