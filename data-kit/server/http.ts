import { createHash, timingSafeEqual } from "node:crypto";
import { ApiError } from "./store";
import type { IngestReceipt } from "./store";
export interface Store {
  ingest(input: unknown, mission: string): Promise<IngestReceipt>;
  history(mission: string, member: string, clock: string, limit: number): Promise<unknown[]>;
}
export interface ApiConfig { token: string; missionId: string }
const digest=(s: string)=>createHash("sha256").update(s).digest();
const json=(status: number, body: unknown)=>new Response(JSON.stringify(body),{
  status, headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"},
});
export function createHandler(store: Store, config: ApiConfig) {
  if(config.token.length<32||!config.missionId.trim())throw new Error("Configura un token de al menos 32 caracteres y la misión autorizada");
  return async (request: Request): Promise<Response> => {
    try {
      const url=new URL(request.url);
      if(url.pathname==="/health"&&request.method==="GET")return json(200,{service:"kawsay-ingestion",mode:"synthetic-only",clinical_engine:false});
      const authorization=request.headers.get("authorization")??"";
      if(!authorization.startsWith("Bearer ")||!timingSafeEqual(digest(authorization.slice(7)),digest(config.token)))
        return json(401,{error:"unauthorized",message:"Token requerido"});
      // Machine-to-machine endpoint; no browser-origin writes, no permissive CORS.
      if(request.headers.has("origin"))return json(403,{error:"browser_origin_rejected",message:"Usa el cliente de ingesta autorizado"});
      if(url.pathname==="/api/v1/observations"){
        if(request.method!=="POST")return json(405,{error:"method_not_allowed"});
        if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")??""))
          return json(415,{error:"json_required"});
        const length=request.headers.get("content-length");
        if(length!==null&&(!/^\d+$/.test(length)||Number(length)>1_048_576))return json(413,{error:"payload_too_large"});
        const reader=request.body?.getReader();
        const chunks: Uint8Array[]=[];let size=0;
        if(reader)try{
          while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;
            if(size>1_048_576){await reader.cancel();return json(413,{error:"payload_too_large"});}chunks.push(value);}
        }finally{reader.releaseLock();}
        let input: unknown;
        try {input=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{return json(400,{error:"invalid_json"});}
        const result=await store.ingest(input,config.missionId);
        return json(result.duplicate?200:201,result);
      }
      const match=/^\/api\/v1\/crew-members\/([^/]+)\/observations$/.exec(url.pathname);
      if(match){
        if(request.method!=="GET")return json(405,{error:"method_not_allowed"});
        const limitText=url.searchParams.get("limit")??"50", limit=Number(limitText);
        const clock=url.searchParams.get("clock_key");
        if(!/^\d+$/.test(limitText)||!Number.isInteger(limit)||limit<1||limit>500||!clock||clock.length>160)
          return json(400,{error:"invalid_query",message:"Indica clock_key y limit entre 1 y 500"});
        const member=decodeURIComponent(match[1]);
        if(member.length>128)return json(400,{error:"invalid_member"});
        return json(200,{mission_id:config.missionId,clock_key:clock,
          observations:await store.history(config.missionId,member,clock,limit)});
      }
      return json(404,{error:"not_found"});
    }catch(e){
      if(e instanceof ApiError)return json(e.status,{error:e.code,message:e.message});
      // Never disclose database errors, URLs, tokens or medical payloads in responses.
      return json(503,{error:"service_unavailable",message:"No se pudo completar la operación"});
    }
  };
}
