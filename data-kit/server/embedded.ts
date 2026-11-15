/** API de integración para datos ficticios: PostgreSQL embebido, sin servidor externo. */
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { ObservationStore } from "./store";
import { serializedDatabase } from "./serialized-db";
import { createHandler } from "./http";
import { applyMigrations } from "./migrations";
import { importGeneratedProfiles } from "./generated-profiles";

const token=process.env.KAWSAY_INGEST_TOKEN??"";
const missionId=process.env.KAWSAY_MISSION_ID??"MISSION-01";
const port=Number(process.env.KAWSAY_API_PORT??"8780");
if(process.env.KAWSAY_DEMO_DATABASE!=="true")throw Error("Este modo requiere KAWSAY_DEMO_DATABASE=true y solo datos ficticios.");
if(token.length<32||token.startsWith("REPLACE_"))throw Error("Configura un token local aleatorio de al menos 32 caracteres.");
if(missionId!=="MISSION-01")throw Error("La semilla de esta demo corresponde a MISSION-01.");
if(!Number.isInteger(port)||port<1024||port>65535)throw Error("Puerto inválido.");
const root=new URL("../../",import.meta.url);
const state=new URL("../.ingestion-data/",import.meta.url);
await mkdir(state,{recursive:true});
const db=new PGlite(fileURLToPath(state));
await db.waitReady;
await applyMigrations(db,{advisoryLock:false});
await db.exec(await readFile(new URL("database/demo_seed.sql",root),"utf8"));
const database=serializedDatabase(db);
await importGeneratedProfiles(database,
  JSON.parse(await readFile(new URL("app/public/data/crew.json",root),"utf8")),
  JSON.parse(await readFile(new URL("contracts/generated-crew-map.json",root),"utf8")));
const handler=createHandler(new ObservationStore(database),{token,missionId});
const server=createServer(async(req,res)=>{
  try {
    const request=new Request(new URL(req.url??"/",`http://127.0.0.1:${port}`),{
      method:req.method,headers:req.headers as HeadersInit,
      ...(req.method!=="GET"&&req.method!=="HEAD"?{body:Readable.toWeb(req),duplex:"half"}:{}),
    } as RequestInit);
    const response=await handler(request);
    res.writeHead(response.status,Object.fromEntries(response.headers.entries()));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {res.writeHead(400,{"Content-Type":"application/json"}).end('{"error":"invalid_request"}');}
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.once("error",async()=>{await db.close();console.error("No se pudo iniciar la API local; comprueba que el puerto esté libre.");process.exitCode=1;});
server.listen(port,"127.0.0.1",()=>console.log(`KAWSAY: API real, SQL embebido y perfiles A–D en http://127.0.0.1:${port}. Solo esta PC; interfaz y motor pendientes de conectar.`));
let stopping=false;
async function stop(){if(stopping)return;stopping=true;server.closeIdleConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();}
process.once("SIGINT",()=>void stop());process.once("SIGTERM",()=>void stop());
