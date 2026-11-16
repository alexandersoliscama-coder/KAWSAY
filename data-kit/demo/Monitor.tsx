import { useEffect, useState } from "react";

interface Assessment {
  status: string; events: string[]; recommendation_ids: string[];
  regla?: string | null; trend_events?: string[]; motor?: string;
}
interface State {
  intervalSeconds: number;
  catalog: Record<string, string>;
  items: {
    sampleId: number; crewId: string; receivedAt: string; stale: boolean; ageSeconds: number;
    simulationTime: { day: number; hour: number }; assessment: Assessment;
    report: null | { createdAt: string; summary: string; llmStatus: string; model: string;
      recommendation_ids: string[] };
  }[];
}
// Niveles del motor oficial (motor/evaluar.mjs, D.13). Reglas en borrador.
const labels: Record<string, string> = {
  EMERGENCY: "Emergencia", PRIORITY: "Prioritario",
  "INSUFFICIENT DATA": "Datos insuficientes: medir de nuevo y repetir la evaluación",
  SIN_CLASIFICAR: "Sin regla aplicable (no equivale a autocuidado ni a estado normal)",
  MOTOR_NO_DISPONIBLE: "Motor oficial no disponible",
};
const urgent = new Set(["EMERGENCY", "PRIORITY", "MOTOR_NO_DISPONIBLE"]);

export function Monitor({ crewId, day, hour, onlySelected = false }: { crewId: string; day: number; hour: number; onlySelected?: boolean }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch("/api/monitor/state", { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Error del monitor");
        if (active) { setState(data); setError(""); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : String(e)); }
    }
    void poll();
    const interval = setInterval(() => void poll(), 2000);
    return () => { active = false; clearInterval(interval); controller.abort(); };
  }, []);
  async function send(path: string, body: object) {
    setBusy(true); setAction("");
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: AbortSignal.timeout(6000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo enviar");
      setAction("Solicitud recibida. Los avisos se publican primero; el resumen aparecerá cuando termine el análisis.");
    } catch (e) { setAction(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <section className="kw-screen" aria-label="Monitor local con Ollama">
    <h2>Monitor local · Ollama</h2>
    <p>Reportes cada cinco minutos mientras el servicio esté encendido. Datos simulados de resolución horaria;
      repetir el análisis no crea una medición nueva. Avisos visibles en este panel abierto.</p>
    <p>Selección actual: {crewId}, día interno {day}, {hour}:00. Usa los controles de Datos de misión para cambiarla.</p>
    <div className="scenes">
      <button disabled={busy} onClick={() => void send("/api/monitor/demo", { crewId, day, hour })}>Enviar esta muestra simulada</button>
      <button disabled={busy || !state?.items.length} onClick={() => void send("/api/monitor/report", {})}>Solicitar reporte ahora</button>
    </div>
    {action && <p role="status">{action}</p>}
    {error && <p role="alert">{error}</p>}
    {state && !state.items.length && <p>No hay muestras en el monitor. Envía una para iniciar.</p>}
    {state?.items.filter(item => !onlySelected || item.crewId === crewId).map(item => <article className="monitor-card" key={item.sampleId}>
      <h3>Tripulante {item.crewId} · muestra #{item.sampleId}</h3>
      <p>Simulación: día interno {item.simulationTime.day}, {item.simulationTime.hour}:00.</p>
      <p role={urgent.has(item.assessment.status) ? "alert" : "status"}>
        <strong>{labels[item.assessment.status] ?? item.assessment.status}</strong>
        {item.assessment.regla ? ` · regla ${item.assessment.regla}` : ""}</p>
      <p>Nivel calculado por el motor oficial (motor/evaluar.mjs) con NEWS2; reglas en borrador pendientes de revisión clínica.</p>
      <ul>{item.assessment.events.map(event => <li key={event}>{event}</li>)}</ul>
      {item.assessment.trend_events?.length ? <>
        <p>Tendencias de demostración (no clínicas, no cambian el nivel):</p>
        <ul>{item.assessment.trend_events.map(event => <li key={event}>{event}</li>)}</ul>
      </> : null}
      {item.stale && <p role="status">Sin nueva muestra recibida en cinco minutos. No representa el estado actual.</p>}
      <p>Recibida: {new Date(item.receivedAt).toLocaleString("es-PE")} · hace {item.ageSeconds} s.</p>
      {item.report ? <>
        <h4>Reporte · {item.report.llmStatus === "ok" ? `IA (${item.report.model}), texto sin validación clínica` : "Respaldo: IA no disponible o respuesta inválida"}</h4>
        <p>{item.report.summary}</p>
        <ul>{item.report.recommendation_ids.map(id => <li key={id}>{state.catalog[id]}</li>)}</ul>
        <p>Generado: {new Date(item.report.createdAt).toLocaleString("es-PE")}</p>
      </> : <p>Resumen pendiente. Los avisos anteriores ya están disponibles.</p>}
    </article>)}
    <p>El formulario manual sigue separado. No hay notificaciones con la aplicación cerrada ni envío a Tierra.</p>
  </section>;
}
