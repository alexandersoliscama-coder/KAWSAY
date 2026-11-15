import { readFile } from "node:fs/promises";
const config=JSON.parse(await readFile(new URL("../../contracts/local-demo.json",import.meta.url),"utf8"));
if(!Number.isInteger(config.port)||config.port<1024||config.port>65535)throw new Error("Puerto inválido");
const base=`http://127.0.0.1:${config.port}`;
if(process.argv.includes("--check")){
  try {
    const response=await fetch(base+"/demo-api/health",{signal:AbortSignal.timeout(2000)});
    const result=await response.json();
    process.exitCode=response.ok&&result.service==="kawsay-ingestion"?0:1;
  }catch{process.exitCode=1;}
}else console.log(base+(process.argv.includes("--users")?"/":"/pruebas.html"));
