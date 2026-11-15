import pg from "pg";
import { readFile } from "node:fs/promises";
import { applyMigrations } from "./migrations";
const command=process.argv[2];
if(!["migrate","seed-demo"].includes(command))throw new Error("Usa migrate o seed-demo");
if(!process.env.DATABASE_URL)throw new Error("Configura DATABASE_URL");
if(command==="seed-demo"&&process.env.KAWSAY_DEMO_DATABASE!=="true")throw new Error("La semilla requiere KAWSAY_DEMO_DATABASE=true");
const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000,statement_timeout:10000});
await client.connect();
try{
  if(command==="migrate"){
    const changes=await applyMigrations(client);
    console.log(changes.length?"Migraciones aplicadas: "+changes.join(", "):"Esquema actualizado; no se requieren cambios.");
  }else{
    await client.query("BEGIN");
    try{
      await client.query(await readFile(new URL("../../database/demo_seed.sql",import.meta.url),"utf8"));
      await client.query("COMMIT");console.log("Semilla ficticia registrada.");
    }catch(e){await client.query("ROLLBACK");throw e;}
  }
}finally{await client.end();}
