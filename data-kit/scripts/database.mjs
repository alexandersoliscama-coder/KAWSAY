import pg from "pg";
import { readFile } from "node:fs/promises";
const command=process.argv[2];
if(!["migrate","seed-demo"].includes(command))throw new Error("Usa migrate o seed-demo");
if(!process.env.DATABASE_URL)throw new Error("Configura DATABASE_URL; no se usan credenciales por defecto.");
if(command==="seed-demo"&&process.env.KAWSAY_DEMO_DATABASE!=="true")throw new Error("Para sembrar identidades ficticias, establece KAWSAY_DEMO_DATABASE=true");
const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000,statement_timeout:10000});
await client.connect();
try{
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(170014)");
  if(command==="migrate"){
    const found=await client.query("SELECT to_regclass('kawsay.schema_migrations') AS name");
    if(found.rows[0].name){
      const version=await client.query("SELECT 1 FROM kawsay.schema_migrations WHERE version='001_ingestion'");
      if(!version.rows.length)throw new Error("Esquema existente desconocido; revisar antes de migrar");
      console.log("Migración 001 ya aplicada.");
    }else await client.query(await readFile(new URL("../../database/001_ingestion.sql",import.meta.url),"utf8"));
  }else await client.query(await readFile(new URL("../../database/demo_seed.sql",import.meta.url),"utf8"));
  await client.query("COMMIT");console.log("Operación SQL completada.");
}catch(e){await client.query("ROLLBACK");throw e;}finally{await client.end();}
