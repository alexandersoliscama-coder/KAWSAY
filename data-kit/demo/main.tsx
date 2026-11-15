import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { CheckIn } from "../src/ui/CheckIn";
import { readCheckIns } from "../src/checkin/storage";
import type { CheckIn as Record } from "../src/checkin/model";
import { answerLabel } from "../src/checkin/model";
import { loadMission, missionSnapshot, CREW_CROSSWALK } from "../src/mission";
import type { Mission, CrewId } from "../src/mission";
import { toTelemetry } from "../src/telemetry";
import { Monitor } from "./Monitor";
import { Explorer } from "./Explorer";
import catalog from "./reference-catalog.json";
import "../src/ui/kawsay.css";
import "./style.css";
import "./dashboard.css";

const crewIds: CrewId[] = ["A", "B", "C", "D"];
const demoId = (id: CrewId) => Object.entries(CREW_CROSSWALK).find(([,v]) => v === id)![0];
const download = (value: unknown, name: string) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value,null,2)], {type:"application/json"}));
  const a = document.createElement("a"); a.href=url; a.download=name; a.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
};

export function App() {
  const [role,setRole] = useState<"astronaut"|"medical">("astronaut");
  const [page,setPage] = useState("home");
  const [crew,setCrew] = useState<CrewId>("A");
  const [day,setDay] = useState(19);
  const [hour,setHour] = useState(12);
  const [mission,setMission] = useState<Mission|null>(null);
  const [error,setError] = useState("");
  const [records,setRecords] = useState<Record[]>([]);
  const [historyError,setHistoryError] = useState("");
  const [playing,setPlaying] = useState(false);
  const [query,setQuery] = useState("");
  const [connected,setConnected] = useState(navigator.onLine);
  const refresh = () => {
    try {setRecords(readCheckIns(localStorage));setHistoryError("");}
    catch(e) {setHistoryError(String(e));}
  };
  useEffect(() => {
    loadMission().then(setMission).catch(e=>setError(String(e)));refresh();
    const online=()=>setConnected(navigator.onLine);
    window.addEventListener("online",online);window.addEventListener("offline",online);
    window.addEventListener("storage",refresh);
    return ()=>{window.removeEventListener("online",online);window.removeEventListener("offline",online);window.removeEventListener("storage",refresh);};
  },[]);
  useEffect(() => {
    if(!playing)return;
    // Accelerated replay: 1 mission hour every 5 seconds, never a real sensor.
    const timer=setTimeout(()=>{
      if(day===29&&hour===23){setPlaying(false);return;}
      if(hour===23){setHour(0);setDay(day+1);}else setHour(hour+1);
    },5000);
    return ()=>clearTimeout(timer);
  },[playing,day,hour]);
  const snap=mission && missionSnapshot(mission,crew,day,hour);
  const v=snap?.vitals;
  const personal=records.filter(r=>r.crewId===demoId(crew)).sort((a,b)=>b.observedAt.localeCompare(a.observedAt));
  const [monitorStatus,setMonitorStatus] = useState("");
  async function sendSample() {
    setMonitorStatus("Enviando…");
    try {
      const response=await fetch("/api/monitor/demo",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({crewId:crew,day,hour}),signal:AbortSignal.timeout(6000)});
      if(!response.ok)throw new Error("Monitor desconectado. Inicia el servicio Python.");
      setMonitorStatus("Muestra enviada. Consulta el análisis en Monitor IA.");
    }catch(e){setMonitorStatus(String(e));}
  }
  return <div className="mission-app">
    <header className="mission-header"><a href="#main" className="brand">K<span>Λ</span>WSAY <small>KUNTUR X / SALUD EN MISIÓN</small></a>
      <div className="role-switch" aria-label="Vista de demostración">
        <button aria-pressed={role==="astronaut"} onClick={()=>{setRole("astronaut");setPage("home");}}>Astronauta</button>
        <button aria-pressed={role==="medical"} onClick={()=>{setRole("medical");setPage("home");}}>Personal médico</button>
      </div>
      <span className="connection">{connected?"● Con conexión de red":"○ Sin conexión de red"}</span>
    </header>
    <div className="demo-banner">SIMULACIÓN · Datos ficticios · Sin conexión a sensores reales · Vistas de demostración sin control de acceso</div>
    <nav className="mission-nav" aria-label="Navegación principal">
      {[["home",role==="medical"?"Tripulación":"Mi estado"],["checkin","Autorreporte"],["monitor","Monitor IA"],["reference","Reglas y casos"],["data","Datos de misión"]].map(([id,label])=>
        <button key={id} aria-current={page===id?"page":undefined} onClick={()=>setPage(id)}>{label}</button>)}
    </nav>
    <main id="main" className="dashboard">
      <section className="mission-controls" aria-label="Control de simulación">
        <label>Tripulante<select value={crew} onChange={e=>setCrew(e.target.value as CrewId)}>{crewIds.map(id=><option key={id} value={id}>{mission?.crew.find(c=>c.id===id)?.name??id}</option>)}</select></label>
        <label>Día de misión<input type="number" min="1" max="30" value={day+1} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=30){setDay(n-1);setPlaying(false);}}}/></label>
        <label>Hora<input type="number" min="0" max="23" value={hour} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=0&&n<=23){setHour(n);setPlaying(false);}}}/></label>
        <button onClick={()=>setPlaying(!playing)} aria-pressed={playing}>{playing?"Pausar recorrido":"Reproducir escenario"}</button>
        <small>Recorrido acelerado: 1 hora simulada cada 5 s.</small>
      </section>
      {error&&<p role="alert">{error}</p>}
      {historyError&&<p role="alert">{historyError}</p>}
      {!mission&&!error&&<p role="status">Cargando misión…</p>}
      {page==="home"&&snap&&<>
        <div className="section-heading"><div><p className="eyebrow">{role==="medical"?"CENTRO DE SEGUIMIENTO":"TU SALUD EN MISIÓN"}</p><h1>{role==="medical"?"Panorama de la tripulación":`Hola, ${snap.crew.name}`}</h1>
          <p>{snap.crew.module} · Día {day+1}, {String(hour).padStart(2,"0")}:00 · reloj de simulación</p></div><span className="status-chip">Valoración pendiente</span></div>
        {role==="medical"&&<div className="crew-grid">{mission!.crew.map(c=>{
          const s=missionSnapshot(mission!,c.id,day,hour);
          return <button className={crew===c.id?"crew-card selected":"crew-card"} key={c.id} onClick={()=>setCrew(c.id)}>
            <strong>{c.name}</strong><span>{c.module}</span><span>SpO₂ {s.vitals?.spo2??"—"} % · PAS {s.vitals?.sbp??"—"}</span><small>Sin clasificación clínica</small></button>;
        })}</div>}
        <section className="vital-grid" aria-label="Mediciones">
          <article className="metric"><span>Presión arterial</span><strong>{v?.sbp??"—"}<small> / —</small></strong><span>mmHg · diastólica sin dato</span><small>Origen: serie simulada · integración automática prevista</small></article>
          <article className="metric"><span>Saturación de oxígeno</span><strong>{v?.spo2??"—"}<small> %</small></strong><span>SpO₂ · calidad sin verificar</span><small>Origen: serie simulada · integración automática prevista</small></article>
          <article className="metric secondary-metric"><span>Frecuencia cardiaca</span><strong>{v?.hr??"—"}<small> lpm</small></strong><span>Dato simulado complementario</span></article>
          <article className="metric secondary-metric"><span>Temperatura</span><strong>{v?.temp??"—"}<small> °C</small></strong><span>Dato simulado complementario</span></article>
        </section>
        <div className="dashboard-grid">
          <section className="panel action-panel"><p className="eyebrow">ESTADO Y SIGUIENTE PASO</p><h2>Revisión pendiente</h2>
            <p>Las reglas médicas están en borrador. Estas mediciones no generan una autorización ni una clasificación clínica.</p>
            <button className="primary" onClick={()=>setPage("checkin")}>Registrar cómo me siento</button>
            <button onClick={()=>void sendSample()}>Analizar muestra en monitor demo</button>
            {monitorStatus&&<p role="status">{monitorStatus}</p>}
            <p className="muted">Repetir el análisis no genera una lectura nueva. Los avisos del monitor son estadísticos.</p>
          </section>
          <section className="panel"><p className="eyebrow">MI CONTEXTO</p><h2>Resumen diario simulado</h2>
            <dl className="context-list"><div><dt>Sueño</dt><dd>{snap.daily?.sleep_h??"—"} h</dd></div><div><dt>Somnolencia KSS</dt><dd>{snap.daily?.kss??"—"} / 9</dd></div>
            <div><dt>CO₂ del módulo</dt><dd>{snap.environment?.co2_mmHg??"—"} mmHg</dd></div></dl>
            <p className="muted">Sueño y síntomas: resumen del día, sin hora de inicio. CO₂: promedio horario.</p>
          </section>
          <section className="panel"><p className="eyebrow">REPORTE MANUAL</p><h2>Último autorreporte</h2>
            {personal[0]?<><p>{new Date(personal[0].observedAt).toLocaleString("es-PE")}</p><p>{Object.keys(personal[0].answers).length} respuestas registradas · {personal[0].crewId}</p>
              <details><summary>Consultar respuestas</summary><dl className="context-list">{Object.entries(personal[0].answers).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{answerLabel(key,value)}</dd></div>)}</dl></details></>:<p>Aún no hay un autorreporte de este tripulante.</p>}
            <p className="muted">Reloj civil del navegador. Se muestra por separado del reloj de misión; no se fusiona con estas mediciones históricas.</p>
          </section>
          <section className="panel secondary-metric"><p className="eyebrow">EVOLUCIÓN</p><h2>SpO₂ · últimas 6 horas simuladas</h2>
            <div className="trend" aria-label="Historial de saturación">{mission!.vitals.filter(r=>r.astro===crew&&r.day===day&&r.hour<=hour&&r.hour>hour-6).map(r=>
              <div key={r.hour}><strong>{r.spo2}%</strong><div style={{height:Math.max(4,(r.spo2-70)*2)}}/><small>{r.hour}:00</small></div>)}</div>
          </section>
        </div>
        {role==="medical"&&<section className="panel"><h2>Procedencia de la muestra</h2><p>PA y SpO₂: simulador histórico. La diastólica falta en el conjunto original. Identidad vinculada mediante DEMO-01…04 ↔ A…D.</p>
          {v&&<><button onClick={()=>download(toTelemetry(v),`kawsay-${crew}-d${day+1}-h${hour}.json`)}>Exportar paquete de telemetría</button><details><summary>Ver contrato de integración</summary><pre>{JSON.stringify(toTelemetry(v),null,2)}</pre></details></>}
        </section>}
      </>}
      {page==="checkin"&&<CheckIn key={crew} initialCrewId={demoId(crew)} onlySelected={role==="astronaut"} onSaved={refresh}/>}
      {page==="monitor"&&<Monitor crewId={crew} day={day} hour={hour} onlySelected={role==="astronaut"}/>}
      {page==="data"&&<Explorer/>}
      {page==="reference"&&<section className="reference"><p className="eyebrow">ESPECIFICACIÓN DEL MOTOR</p><h1>Reglas y casos de referencia</h1>
        <p>34 reglas · 60 casos · 58 fuentes. Borrador pendiente de revisión médica; las acciones terapéuticas no están activadas.</p>
        <a href="https://docs.google.com/spreadsheets/d/1YEJ51SdlEczKco_K-ZaAv-mSCbTSxhe0/edit" target="_blank" rel="noreferrer">Abrir documento del equipo</a>
        <p><label>Buscar regla<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="ID, tema o dato requerido"/></label></p>
        <div className="reference-grid">{catalog.rules.filter(r=>[r.ID,r.Rule,r["Data needed"]].join(" ").toLowerCase().includes(query.toLowerCase())).map(r=>
          <details className="panel" key={r.ID}><summary><strong>{r.ID}</strong> · {r.Rule}</summary><p>{r["Trigger (if this happens)"]}</p><p>Datos: {r["Data needed"]}</p><p>Nivel propuesto: {r.Level}</p><p>{r["Limitations / what to disclose"]}</p><p>Revisión: {r["Reviewed by"]}</p></details>)}</div>
        <h2>Banco de evaluación</h2><p>Los casos publicados y los espaciales ficticios conservan su procedencia. Los niveles de referencia pendientes no se presentan como resultados del sistema.</p>
        <button onClick={()=>download(catalog,"kawsay-referencia-borrador.json")}>Exportar reglas, casos y fuentes</button>
        <div className="table-scroll"><table><caption>Casos espaciales del equipo · pendientes de firma</caption><thead><tr><th>Caso</th><th>Tema</th><th>Referencia propuesta</th><th>Regla esperada</th></tr></thead><tbody>
          {catalog.cases.filter(c=>c.ID.startsWith("E")).map(c=><tr key={c.ID}><td>{c.ID}</td><td>{c["Topic and source"]}</td><td>{c["Correct level (reference)"]}</td><td>{c["Expected rule"]}</td></tr>)}
        </tbody></table></div>
      </section>}
    </main><footer className="mission-footer">KAWSAY · Prototipo de misión · Datos sintéticos · La selección de vista no es autenticación</footer>
  </div>;
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<App/>);
if("serviceWorker" in navigator && location.protocol !== "file:" && !(globalThis as typeof globalThis & { __KAWSAY_MISSION__?: unknown }).__KAWSAY_MISSION__) {
  window.addEventListener("load",()=>{navigator.serviceWorker.register("/sw.js").catch(()=>{ /* Online app remains usable. */ });});
}
