import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { DbResult } from "./store";
interface MigrationClient {
  query(sql:string,values?:any[]):Promise<DbResult>;
  exec?(sql:string):Promise<unknown>;
}
export const MIGRATIONS=["001_ingestion","002_baselines"] as const;
/** Runs all pending migrations atomically. Existing histories are never reseeded or removed. */
export async function applyMigrations(client:MigrationClient, options:{advisoryLock?:boolean;directory?:string}={}) {
  const directory=options.directory??fileURLToPath(new URL("../../database/",import.meta.url));
  const { resolve }=await import("node:path");
  const applied:string[]=[];
  await client.query("BEGIN");
  try {
    if(options.advisoryLock!==false)await client.query("SELECT pg_advisory_xact_lock(170014)");
    const table=await client.query("SELECT to_regclass('kawsay.schema_migrations') AS name");
    const versions=table.rows[0].name?(await client.query("SELECT version FROM kawsay.schema_migrations")).rows.map(r=>String(r.version)):[];
    if(versions.some(v=>!MIGRATIONS.includes(v as typeof MIGRATIONS[number])))throw new Error("Esquema con versiones desconocidas; no se modifica");
    if(versions.includes("002_baselines")&&!versions.includes("001_ingestion"))throw new Error("Historial de migraciones inconsistente");
    for(const version of MIGRATIONS){
      if(versions.includes(version))continue;
      const sql=await readFile(resolve(directory,version+".sql"),"utf8");
      if(client.exec)await client.exec(sql);else await client.query(sql);
      applied.push(version);
    }
    await client.query("COMMIT");
    return applied;
  }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e;}
}
