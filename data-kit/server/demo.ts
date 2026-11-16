import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { PGlite } from "@electric-sql/pglite";
import { ObservationStore } from "./store";
import { serializedDatabase } from "./serialized-db";
import { createHandler } from "./http";
import { applyMigrations } from "./migrations";
import { importGeneratedProfiles } from "./generated-profiles";

const kit=fileURLToPath(new URL("../",import.meta.url));
const root=resolve(kit,"dist"), state=resolve(kit,".demo-data");
const config=JSON.parse(await readFile(resolve(kit,"../contracts/local-demo.json"),"utf8"));
const port=config.port;
if(typeof port!=="number"||!Number.isInteger(port)||port<1024||port>65535)throw new Error("Puerto inválido en contracts/local-demo.json");
await mkdir(state,{recursive:true});
const db=new PGlite(state);
await db.waitReady;
await applyMigrations(db,{advisoryLock:false});
await db.exec(await readFile(resolve(kit,"../database/demo_seed.sql"),"utf8"));
await importGeneratedProfiles(serializedDatabase(db),
  JSON.parse(await readFile(resolve(kit,"../app/public/data/crew.json"),"utf8")),
  JSON.parse(await readFile(resolve(kit,"../contracts/generated-crew-map.json"),"utf8")));
const token=randomBytes(32).toString("hex");
const handler=createHandler(new ObservationStore(serializedDatabase(db)),{token,missionId:"MISSION-01"});
const origins=[`http://127.0.0.1:${port}`,`http://localhost:${port}`];
const monitorUrl=process.env.KAWSAY_MONITOR_URL??"http://127.0.0.1:8765";
const mime:Record<string,string>={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",
  ".svg":"image/svg+xml",".webmanifest":"application/manifest+json"};
const server=createServer(async(req,res)=>{
  try {
    if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host??"")){
      res.writeHead(403).end();return;
    }
    const url=new URL(req.url??"/",origins[0]);
    if(url.pathname.startsWith("/demo-api/")){
      if(req.method!=="GET"&&!origins.includes(req.headers.origin??"")){
        res.writeHead(403,{"Content-Type":"application/json"}).end('{"error":"same_origin_required"}');return;
      }
      const headers=new Headers();
      if(req.headers["content-type"])headers.set("content-type",String(req.headers["content-type"]));
      if(req.headers["content-length"])headers.set("content-length",String(req.headers["content-length"]));
      headers.set("Authorization","Bearer "+token);
      const request=new Request(origins[0]+url.pathname.slice("/demo-api".length)+url.search,{
        method:req.method,headers,
        ...(req.method!=="GET"&&req.method!=="HEAD"?{body:Readable.toWeb(req) as ReadableStream,duplex:"half"}:{}),
      } as RequestInit);
      const result=await handler(request);
      res.writeHead(result.status,Object.fromEntries(result.headers.entries()));
      res.end(Buffer.from(await result.arrayBuffer()));return;
    }
    if(["/api/monitor/state","/api/monitor/demo","/api/monitor/report","/api/monitor/case"].includes(url.pathname)){
      // Proxy de mismo origen hacia el servicio Python (Ollama). Sin CORS y sin exponer Ollama al navegador.
      if(req.method!=="GET"&&req.method!=="POST"){res.writeHead(405).end();return;}
      if(req.method==="POST"&&!origins.includes(req.headers.origin??"")){
        res.writeHead(403,{"Content-Type":"application/json"}).end('{"error":"same_origin_required"}');return;
      }
      const chunks:Buffer[]=[];let size=0;
      for await(const chunk of req){size+=(chunk as Buffer).length;if(size>(url.pathname==="/api/monitor/case"?4096:1024)){res.writeHead(413).end();return;}chunks.push(chunk as Buffer);}
      try{
        const upstream=await fetch(monitorUrl+url.pathname+url.search,{
          method:req.method,
          headers:{"Content-Type":"application/json",...(req.headers.origin?{Origin:req.headers.origin}:{})},
          ...(req.method==="POST"?{body:Buffer.concat(chunks)}:{}),
          signal:AbortSignal.timeout(5000),
        });
        res.writeHead(upstream.status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
        res.end(await upstream.text());
      }catch{
        res.writeHead(503,{"Content-Type":"application/json; charset=utf-8"}).end(JSON.stringify({error:"Monitoring service disconnected. Start python llm-service/service.py"}));
      }
      return;
    }
    if(url.pathname.startsWith("/api/")){res.writeHead(404,{"Content-Type":"application/json"}).end('{"error":"not_found"}');return;}
    if(req.method!=="GET"&&req.method!=="HEAD"){res.writeHead(405).end();return;}
    const file=resolve(root,"."+decodeURIComponent(url.pathname==="/"?"/index.html":url.pathname));
    if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
    const bytes=await readFile(file);
    res.writeHead(200,{"Content-Type":mime[extname(file)]??"application/octet-stream","Cache-Control":"no-store"});
    res.end(req.method==="HEAD"?undefined:bytes);
  }catch{res.writeHead(404,{"Content-Type":"text/plain; charset=utf-8"}).end("No disponible. Ejecuta primero npm run build y npm run build:api.");}
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.on("error",async(error)=>{console.error("No se pudo abrir el puerto local:",(error as NodeJS.ErrnoException).code);await db.close();process.exitCode=1;});
server.listen(port,"127.0.0.1",()=>console.log(`KAWSAY demo: ${origins[0]}/pruebas.html · PostgreSQL embebido persistente · Monitor IA vía http://127.0.0.1:8765 (inícialo con python llm-service/service.py)`));
async function stop(){server.close();server.closeIdleConnections();await db.close();}
process.once("SIGINT",()=>void stop());process.once("SIGTERM",()=>void stop());
