import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { parseIngestion } from "../src/ingestion";
import { ObservationStore } from "../server/store";
import { serializedDatabase } from "../server/serialized-db";
import { applyMigrations } from "../server/migrations";
import { importGeneratedProfiles } from "../server/generated-profiles";
import { createHandler } from "../server/http";

// Importación por URL: conserva los módulos ESM originales de Yeremi.
const modulo = (nombre:string) => import(new URL(`../../simulator/${nombre}.mjs`, import.meta.url).href);
const { cargarConfig, cargarVitals, configConMapa } = await modulo("source");
const { paqueteDeHora } = await modulo("packet");
const { aplicarEstado } = await modulo("estados");
const { enviarPaquete, leerHistorial } = await modulo("transport");
const config = cargarConfig();
const datos = cargarVitals(config.rutaVitals);
const json = (ruta:string) => JSON.parse(readFileSync(new URL(ruta, import.meta.url), "utf8"));
const paquete = (personas:string[], hora=0) => paqueteDeHora(datos, config, personas, 0, hora);

describe("simulador de Yeremi + contrato real", () => {
  it("valida 720 paquetes grupales y los cinco estados con parseIngestion", () => {
    let revisados=0;
    for(let dia=0;dia<30;dia++) for(let hora=0;hora<24;hora++) {
      parseIngestion(paqueteDeHora(datos, config, ["A","B","C","D"], dia, hora));
      revisados++;
    }
    for(const estado of ["medible","invalida","esperando","sin_reporte","sin_medio"]) {
      const p=paquete(["A"]);
      p.subjects[0].observations=p.subjects[0].observations.map((o:unknown)=>aplicarEstado(o, estado, "prueba de integración"));
      parseIngestion(p); revisados++;
    }
    expect(revisados).toBe(725);
  },30000);
  it("usa el mapa compartido y rechaza otra misión o identidades repetidas", () => {
    const mapa=json("../../contracts/generated-crew-map.json");
    expect(config.tripulantes.A.crew_member_id).toBe(mapa.members[0].crew_member_id);
    expect(()=>configConMapa(config,{...mapa,mission_id:"OTRA"})).toThrow();
    expect(()=>configConMapa(config,{...mapa,members:[mapa.members[0],mapa.members[0]]})).toThrow();
  });
});

const probarHttp=process.env.KAWSAY_TEST_HTTP==="true";
describe(`transporte + receptor real + SQL embebido (${probarHttp?"HTTP loopback":"en proceso, sin sockets"})`, () => {
  let db:PGlite;
  let server:ReturnType<typeof createServer>;
  let opciones:{base:string;token:string;fetchImpl?:(input:string,init?:RequestInit)=>Promise<Response>};
  let outbox:any;
  let temporal:string;
  const anterior=process.env.KAWSAY_OUTBOX_DIR;
  beforeAll(async()=>{
    temporal=mkdtempSync(join(tmpdir(),"kawsay-integracion-"));
    process.env.KAWSAY_OUTBOX_DIR=temporal;
    outbox=await modulo("outbox");
    db=new PGlite(); await db.waitReady;
    await applyMigrations(db,{advisoryLock:false});
    await db.exec(readFileSync(new URL("../../database/demo_seed.sql",import.meta.url),"utf8"));
    const database=serializedDatabase(db);
    await importGeneratedProfiles(database,json("../../app/public/data/crew.json"),json("../../contracts/generated-crew-map.json"));
    const token=randomBytes(32).toString("hex");
    const handler=createHandler(new ObservationStore(database),{token,missionId:config.missionId});
    if(!probarHttp) {
      opciones={base:"http://localhost",token,fetchImpl:(input,init)=>handler(new Request(input,init))};
      return;
    }
    server=createServer(async(req,res)=>{
      try {
        const request=new Request(new URL(req.url??"/","http://localhost"),{
          method:req.method,headers:req.headers as HeadersInit,
          ...(req.method!=="GET"&&req.method!=="HEAD"?{body:Readable.toWeb(req),duplex:"half"}:{}),
        } as RequestInit);
        const response=await handler(request);
        res.writeHead(response.status,Object.fromEntries(response.headers.entries()));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch {res.writeHead(500).end();}
    });
    await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
    const direccion=server.address();
    if(!direccion||typeof direccion==="string")throw Error("Sin puerto local");
    opciones={base:`http://127.0.0.1:${direccion.port}`,token};
  },30000);
  afterAll(async()=>{
    if(server?.listening)await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
    await db?.close();
    if(anterior===undefined)delete process.env.KAWSAY_OUTBOX_DIR;else process.env.KAWSAY_OUTBOX_DIR=anterior;
    if(temporal)rmSync(temporal,{recursive:true,force:true});
  });
  it("recibe individual y grupo, reconoce duplicados y separa el historial A–D",async()=>{
    const primero=await enviarPaquete(paquete(["A"]),opciones);
    expect(primero.codigo,JSON.stringify(primero)).toBe(201);
    const grupo=paquete(["A","B","C","D"]);
    expect((await enviarPaquete(grupo,opciones)).codigo).toBe(201);
    expect((await enviarPaquete(grupo,opciones)).codigo).toBe(200);
    for(const letra of ["A","B","C","D"]) {
      const member=config.tripulantes[letra].crew_member_id;
      const historia=await leerHistorial(member,opciones);
      expect(historia).toHaveLength(8);
      expect(historia.every((r:any)=>r.crew_member_id===member)).toBe(true);
    }
    const conflicto=structuredClone(grupo);conflicto.subjects[0].observations[0].value+=1;
    expect((await enviarPaquete(conflicto,opciones)).codigo).toBe(409);
    const invalido=paquete(["A"],1);invalido.subjects[0].observations[0].unit="incorrecta";
    expect((await enviarPaquete(invalido,opciones)).codigo).toBe(422);
    expect((await enviarPaquete(grupo,{...opciones,token:"incorrecto"})).codigo).toBe(401);
  });
  it("revierte todo un grupo si D no pertenece a la misión",async()=>{
    const grupo=paquete(["A","B","C","D"],1);grupo.subjects[3].user_id="NO-REGISTRADO";
    expect((await enviarPaquete(grupo,opciones)).codigo).toBe(422);
    const rows=await db.query<{n:number}>("SELECT count(*) AS n FROM kawsay.observations WHERE observation_id LIKE '%d00h01%'");
    expect(Number(rows.rows[0].n)).toBe(0);
  });
  it("conserva el paquete tras una pérdida de respuesta y lo reenvía sin duplicarlo",async()=>{
    const p=paquete(["B"],2);
    // Simula que el servidor guardó el paquete pero se perdió la confirmación.
    expect((await enviarPaquete(p,opciones)).codigo).toBe(201);
    outbox.guardarPendiente(p);
    const pendiente=outbox.listarPendientes()[0];
    expect(JSON.parse(readFileSync(pendiente,"utf8"))).toEqual(p);
    expect(await outbox.vaciarOutbox(opciones,{intentos:1})).toMatchObject({duplicados:1,quedan:0});
    expect(outbox.listarPendientes()).toHaveLength(0);
    const rows=await db.query<{n:number}>("SELECT count(*) AS n FROM kawsay.observations WHERE observation_id LIKE '%d00h02%'");
    expect(Number(rows.rows[0].n)).toBe(8);
  });
  it("guarda durante un corte y vacía la cola cuando vuelve el receptor",async()=>{
    const p=paquete(["C"],3);
    const caida={...opciones,fetchImpl:async()=>{throw new Error("corte simulado");}};
    expect(await outbox.enviarOGuardar(p,caida,{intentos:1})).toMatchObject({resultado:"pendiente"});
    expect(outbox.listarPendientes()).toHaveLength(1);
    expect(await outbox.vaciarOutbox(opciones,{intentos:1})).toMatchObject({enviados:1,quedan:0});
    expect(outbox.listarPendientes()).toHaveLength(0);
  });
});
