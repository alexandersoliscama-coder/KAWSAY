import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { CheckIn } from "../src/ui/CheckIn";
import { generatedToInput } from "../src/adapters";
import { loadMission, missionSnapshot } from "../src/mission";
import type { CrewId, Mission } from "../src/mission";
import "../src/ui/kawsay.css";
import "./style.css";

function App() {
  const [tab, setTab] = useState("data");
  const [mission, setMission] = useState<Mission | null>(null);
  const [error, setError] = useState("");
  const [crew, setCrew] = useState<CrewId>("A");
  const [day, setDay] = useState(19);
  const [hour, setHour] = useState(12);
  useEffect(() => { loadMission().then(setMission).catch(e => setError(String(e))); }, []);
  const snapshot = mission && missionSnapshot(mission, crew, day, hour);
  const scenes: [string, CrewId, number, number][] = [
    ["Ana · día interno 19", "A", 19, 12], ["Ana · día interno 20", "A", 20, 12],
    ["Ben · sueño", "B", 14, 12], ["Ben · EVA prevista", "B", 15, 12],
    ["Carla · ambiente", "C", 22, 11], ["Diego · autorreporte", "D", 25, 12],
  ];
  return <>
    <header><strong>KAWSAY</strong><span>Datos y generador · Recuperación de prácticas</span></header>
    <nav aria-label="Módulos"><button onClick={() => setTab("data")} aria-pressed={tab === "data"}>Datos de misión</button>
      <button onClick={() => setTab("checkin")} aria-pressed={tab === "checkin"}>Mi revisión</button></nav>
    {tab === "checkin" ? <CheckIn /> : <main className="kw-screen">
      <h1>Explorar datos sintéticos</h1>
      <p>4 perfiles · 30 días · Datos ficticios. Sin clasificación clínica ni autorización de EVA.</p>
      {error && <p role="alert">No se pudieron cargar los datos: {error}. Ejecuta primero el generador y vuelve a compilar.</p>}
      {!mission && !error && <p role="status">Cargando datos…</p>}
      {mission && snapshot && <>
        <p>{mission.vitals.length.toLocaleString("es-PE")} observaciones fisiológicas · {mission.daily.length} resúmenes diarios · {mission.environment.length} registros ambientales</p>
        <div className="scenes">{scenes.map(([label, id, d, h]) => <button key={label} onClick={() => {setCrew(id);setDay(d);setHour(h);}}>{label}</button>)}</div>
        <div className="controls">
          <label>Tripulante <select value={crew} onChange={e => setCrew(e.target.value as CrewId)}>{mission.crew.map(c => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}</select></label>
          <label>Día mostrado (1–30) <input type="number" min={1} max={30} value={day + 1} onChange={e => {const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=30)setDay(n-1);}} /></label>
          <label>Hora <input type="number" min={0} max={23} value={hour} onChange={e => {const n=Number(e.target.value);if(Number.isInteger(n)&&n>=0&&n<=23)setHour(n);}} /></label>
        </div>
        <h2>{snapshot.crew.name} · {snapshot.crew.module}</h2>
        <p>Día interno {day}; día mostrado {day+1}; hora {hour}:00 de la simulación.</p>
        <h3>Mediciones de esa hora</h3><pre>{JSON.stringify(snapshot.vitals ?? { missing: true }, null, 2)}</pre>
        <h3>Resumen diario</h3><pre>{JSON.stringify(snapshot.daily ?? { missing: true }, null, 2)}</pre>
        <h3>Ambiente del módulo · promedio horario sintético</h3><pre>{JSON.stringify(snapshot.environment ?? { missing: true }, null, 2)}</pre>
        <details><summary>Contrato propuesto para conectar con el motor</summary><pre>{JSON.stringify(generatedToInput(mission, crew, day, hour), null, 2)}</pre></details>
        <p>El formulario conserva sus registros por separado. No se fusionan mediciones de momentos distintos. La aptitud y las alertas las resolverá el motor revisado del equipo.</p>
      </>}
    </main>}
  </>;
}
createRoot(document.getElementById("root")!).render(<App />);
