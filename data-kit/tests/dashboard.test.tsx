// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { App } from "../demo/main";
import { parseMission } from "../src/mission";
import { prepareCheckIn, emptyDraft } from "../src/checkin/model";
import { appendCheckIn } from "../src/checkin/storage";
import { CheckIn } from "../src/ui/CheckIn";

const mission = parseMission(Object.fromEntries(["crew","vitals","daily","environment"].map(
  name=>[name,JSON.parse(readFileSync(resolve("../app/public/data",name+".json"),"utf8"))])));
vi.mock("../src/mission",async original=>{
  const mod = await original<typeof import("../src/mission")>();
  return {...mod,loadMission:vi.fn(async()=>mission)};
});
afterEach(()=>{cleanup();localStorage.clear();vi.useRealTimers();});
describe("mission dashboard",()=>{
  it("switches views and carries the selected crew into the personal report",async()=>{
    render(<App/>);
    await waitFor(()=>expect(screen.getByRole("heading",{name:/Hola,/})).toBeTruthy());
    expect(screen.getByText("mmHg · diastólica sin dato")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Personal médico"}));
    expect(screen.getByRole("heading",{name:"Panorama de la tripulación"})).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Tripulante"),{target:{value:"B"}});
    fireEvent.click(screen.getByRole("button",{name:"Astronauta"}));
    fireEvent.click(screen.getByRole("button",{name:"Autorreporte"}));
    const selected=screen.getByLabelText("Tripulante simulado") as HTMLSelectElement;
    expect(selected.value).toBe("DEMO-02");
    expect(selected.disabled).toBe(true);
  });
  it("does not wrap the replay back to earlier readings at the end of mission",async()=>{
    render(<App/>);
    await waitFor(()=>expect(screen.getByRole("heading",{name:/Hola,/})).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Día de misión"),{target:{value:"30"}});
    fireEvent.change(screen.getByLabelText("Hora"),{target:{value:"23"}});
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button",{name:"Reproducir escenario"}));
    await act(async()=>vi.advanceTimersByTime(5000));
    expect((screen.getByLabelText("Hora") as HTMLInputElement).value).toBe("23");
    expect(screen.getByRole("button",{name:"Reproducir escenario"})).toBeTruthy();
  });
  it("filters personal history and its export without deleting other crew records",()=>{
    const now=new Date("2026-11-13T15:00:00Z");
    for(const crewId of ["DEMO-01","DEMO-02"]){
      const {record}=prepareCheckIn({...emptyDraft(now),crewId,values:{"symptoms.fatigue":"absent"}},now,crewId);
      appendCheckIn(localStorage,record!);
    }
    render(<CheckIn initialCrewId="DEMO-01" onlySelected/>);
    expect(screen.getByText("Historial local (1)")).toBeTruthy();
    const href=screen.getByRole("link",{name:"Exportar historial JSON"}).getAttribute("href")!;
    const exported=JSON.parse(decodeURIComponent(href.split(",")[1]));
    expect(exported.records.map((r:{crewId:string})=>r.crewId)).toEqual(["DEMO-01"]);
  });
});
