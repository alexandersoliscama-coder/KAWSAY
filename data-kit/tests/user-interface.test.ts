// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
afterEach(()=>{localStorage.clear();document.body.innerHTML="";vi.restoreAllMocks();});
describe("approved standalone user interface",()=>{
  it("renders both profiles and every navigation section",()=>{
    const html=readFileSync(resolve("../KAWSAY-interfaces.html"),"utf8");
    document.documentElement.innerHTML=html.replace(/<!doctype html>/i,"");
    vi.spyOn(window,"scrollTo").mockImplementation(()=>{});
    const script=document.querySelector("script")?.textContent;
    expect(script).toBeTruthy();
    window.eval(script!);
    expect(document.querySelector("h1")?.textContent).toBeTruthy();
    for(const role of ["astronauta","medico"]){
      (document.querySelector(`[data-role="${role}"]`) as HTMLElement).click();
      expect(document.querySelector(`[data-role="${role}"]`)?.getAttribute("aria-pressed")).toBe("true");
      const pages=Array.from(document.querySelectorAll("#nav [data-page]")).map(b=>b.getAttribute("data-page"));
      expect(pages.length).toBeGreaterThanOrEqual(5);
      for(const page of pages){
        (document.querySelector(`#nav [data-page="${page}"]`) as HTMLElement).click();
        expect(document.querySelector("#main h1")?.textContent).toBeTruthy();
      }
    }
  });
});
