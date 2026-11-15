import { expect, it } from "vitest";
import { serializedDatabase } from "../server/serialized-db";
it("does not interleave embedded transactions and release is idempotent",async()=>{
  const calls:string[]=[];
  const db=serializedDatabase({query:async(sql)=>{calls.push(sql);return {rows:[]};}});
  const first=await db.connect();
  let connected=false;
  const secondPromise=db.connect().then(c=>{connected=true;return c;});
  await first.query("BEGIN");
  await Promise.resolve();
  expect(connected).toBe(false);
  await first.query("COMMIT");first.release();first.release();
  const second=await secondPromise;
  await second.query("BEGIN");await second.query("COMMIT");second.release();
  expect(calls).toEqual(["BEGIN","COMMIT","BEGIN","COMMIT"]);
});
