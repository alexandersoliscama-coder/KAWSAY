import { readFile } from "node:fs/promises";
const example=process.argv[2]??"individual";
if(!["individual","group"].includes(example))throw new Error("Usa individual o group");
const token=process.env.KAWSAY_INGEST_TOKEN;
if(!token||token.length<32)throw new Error("Configura KAWSAY_INGEST_TOKEN");
const packet=JSON.parse(await readFile(new URL(`../../contracts/examples/${example}.json`,import.meta.url),"utf8"));
const url=process.env.KAWSAY_API_URL??"http://127.0.0.1:8780";
const response=await fetch(new URL("/api/v1/observations",url),{method:"POST",
  headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
  body:JSON.stringify(packet),signal:AbortSignal.timeout(15000)});
const body=await response.json();
if(!response.ok)throw new Error(body.message??body.error??"Envío fallido");
console.log(JSON.stringify({status:response.status,...body},null,2));
