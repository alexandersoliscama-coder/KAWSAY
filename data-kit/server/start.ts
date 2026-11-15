import { createServer } from "node:http";
import { Readable } from "node:stream";
import pg from "pg";
import { ObservationStore } from "./store";
import { createHandler } from "./http";

const token=process.env.KAWSAY_INGEST_TOKEN??"", missionId=process.env.KAWSAY_MISSION_ID??"";
if(!process.env.DATABASE_URL)throw new Error("Falta DATABASE_URL");
const port=Number(process.env.KAWSAY_API_PORT??"8780");
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error("Puerto inválido");
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:5000,
  idleTimeoutMillis:10000,statement_timeout:10000});
pool.on("error",()=>console.error("Conexión de base de datos interrumpida"));
const handler=createHandler(new ObservationStore(pool),{token,missionId});
const version=await pool.query("SELECT 1 FROM kawsay.schema_migrations WHERE version='002_baselines'");
if(!version.rows.length)throw new Error("Ejecuta db:migrate antes de iniciar");
const server=createServer(async(req,res)=>{
  try{
    const request=new Request(new URL(req.url??"/",`http://127.0.0.1:${port}`),{
      method:req.method,headers:req.headers as HeadersInit,
      ...(req.method!=="GET"&&req.method!=="HEAD"?{body:Readable.toWeb(req) as ReadableStream,duplex:"half"}:{}),
    } as RequestInit);
    const response=await handler(request);
    res.writeHead(response.status,Object.fromEntries(response.headers.entries()));
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(400,{"Content-Type":"application/json"}).end('{"error":"invalid_request"}');}
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(port,"127.0.0.1",()=>console.log(`KAWSAY ingestion: http://127.0.0.1:${port} (solo datos sintéticos)`));
async function stop(){server.close();server.closeIdleConnections();await pool.end();}
process.once("SIGINT",()=>void stop());process.once("SIGTERM",()=>void stop());
