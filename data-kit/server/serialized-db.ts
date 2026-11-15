import type { Database, DbResult } from "./store";
/** One embedded engine connection: serialize complete transactions, not individual SQL calls. */
export function serializedDatabase(engine: {query(sql:string, values?:any[]):Promise<DbResult>}):Database {
  let tail=Promise.resolve();
  return {async connect(){
    const previous=tail;
    let unlock!:()=>void;
    tail=new Promise<void>(resolve=>{unlock=resolve;});
    await previous;
    let released=false;
    return {query:(sql,values)=>engine.query(sql,values),release:()=>{if(!released){released=true;unlock();}}};
  }};
}
