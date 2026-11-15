import pg from "pg";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { importGeneratedProfiles } from "./generated-profiles";
if(!process.env.DATABASE_URL||process.env.KAWSAY_DEMO_DATABASE!=="true")
  throw new Error("Configura DATABASE_URL y KAWSAY_DEMO_DATABASE=true para importar datos ficticios");
const raw=await readFile(new URL("../../app/public/data/crew.json",import.meta.url));
const manifest=JSON.parse(await readFile(new URL("../../app/public/data/manifest.json",import.meta.url),"utf8"));
if(manifest.synthetic!==true||createHash("sha256").update(raw).digest("hex")!==manifest.files?.["crew.json"]?.sha256)
  throw new Error("El archivo de perfiles no coincide con el manifiesto");
const mapping=JSON.parse(await readFile(new URL("../../contracts/generated-crew-map.json",import.meta.url),"utf8"));
if(process.env.KAWSAY_MISSION_ID&&process.env.KAWSAY_MISSION_ID!==mapping.mission_id)throw new Error("La misión configurada no coincide con la correspondencia");
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:5000,statement_timeout:10000});
try{console.log(JSON.stringify(await importGeneratedProfiles(pool,JSON.parse(raw.toString("utf8")),mapping)));}
finally{await pool.end();}
