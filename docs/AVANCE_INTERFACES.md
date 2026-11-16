# KAWSAY — interfaces y estado de integración

Actualizado: 14 de noviembre de 2026.

## Interfaz conectada a datos, motor NEWS2 y Monitor IA (15 de noviembre de 2026)

Rama local `integracion/interfaz-conectada`, creada desde `integracion/unificada` (3d2b0c5).

- `KAWSAY-interfaces.html` (entrada `/`) ya no usa tripulantes ni valores fijos: lee `/data/*.json` del generador, tiene reloj de simulación
  (tripulante, día, hora, reproducción de 1 h cada 5 s) y selector **Smartwatch / Simulación**.
- **Smartwatch sin integración:** el astronauta copia a mano los valores de su reloj en *Reportar → Smartwatch* (FC, FR, SpO₂, PAS/PAD,
  temperatura, conciencia y oxígeno). Cada dato es opcional; un dato ausente nunca se interpreta como normal. Se guarda en el navegador.
- **Motor NEWS2 en la interfaz:** `motor/navegador.mjs` empaqueta la misma función `evaluar()` del motor (`dist/engine.js`; solo se sustituye
  `engine-adapter.mjs`, que usa módulos de Node). La pantalla muestra nivel, regla (R01/R02/R03/R19), componentes y faltantes, y con datos
  incompletos no calcula total (R19). Reproduce el caso del hallazgo 4: FC 135, FR 26, SpO₂ 91, PAS 120, T 36,8, alerta, oxígeno «No» → NEWS2 9 / R01.
- **Monitor IA en el mismo puerto (hallazgo 6/28):** `data-kit/server/demo.ts` reenvía `/api/monitor/*` al servicio Python (8765, o
  `KAWSAY_MONITOR_URL`), solo mismo origen; el servicio acepta el origen 4180. Sin Python responde 503 con mensaje claro.
- `Iniciar-KAWSAY-IA.cmd` compila, abre el servicio Python y la demo en http://127.0.0.1:4180/.
- `package-lock.json` regenerado: `npm ci` fallaba por `esbuild@0.28.2` ausente del lock.

### Niveles de color y emergencia (interfaz)

Colores por nivel NEWS2 (borrador, sin revisión clínica), visibles para astronauta y personal médico (tarjetas de tripulación, resumen, detalle, Monitor IA):
verde SELF-CARE (0: cuidados en la estación, sin comunicación), amarillo SCHEDULED (1 a 4: programar y observar; actuar de inmediato si hay deterioro),
naranja PRIORITY (5 a 6, o un parámetro con 3: atención urgente sin demora), rojo EMERGENCY (7 o más: avisar al médico de inmediato y activar el equipo de emergencia),
gris INSUFFICIENT DATA (faltan datos: no se calcula total).
Los niveles SCHEDULED y SELF-CARE se derivan del total en la interfaz; el motor (`motor/evaluar.mjs`) no los clasifica y su nota pide decisión clínica: pendiente de confirmar con el equipo clínico.

- Reporte cotidiano (pestaña Smartwatch): todos los campos son obligatorios; conciencia (ACVPU) y oxígeno suplementario no tienen opción "sin dato".
- Botón rojo EMERGENCY (solo en el perfil Astronauta): formulario con lo esencial (síntomas, FR, SpO2, O2 suplementario, PAS, FC, ACVPU, T), todo opcional.
  Crea un reporte de emergencia visible para el médico (banner rojo, tarjeta de tripulación y Alertas). El prototipo no llama ni envía mensajes a nadie.

### Funcionamiento sin internet

Una vez, con internet: `Preparar-OFFLINE.cmd` (`npm ci`, compilar interfaz y API, `ollama pull qwen3:4b`). Después, sin conexión:
`Iniciar-KAWSAY-OFFLINE.cmd` (comprueba o inicia Ollama, precarga el modelo, abre el Monitor IA y la demo en http://127.0.0.1:4180/).

- La interfaz no usa CDN, fuentes ni scripts externos; solo las citas del catálogo son enlaces a Internet y no se cargan solas.
- El servicio Python usa solo la biblioteca estándar y llama a Ollama en `127.0.0.1:11434` sin pasar por proxies del sistema.
- Se pide `keep_alive: 30m` a Ollama para que el modelo siga en memoria entre reportes (cada 300 s) y no se recargue en cada ciclo.
- Verificado con todos los servicios dentro de un entorno sin acceso a internet (solo bucle local), usando un Ollama simulado.
  No verificado: `scripts/Ollama-Listo.ps1` en Windows ni la latencia de `qwen3:4b` real en cada equipo.

Pendiente (sin cambios): la interfaz no lee la API SQL; el aviso del Monitor IA (desviaciones z) y la evaluación NEWS2 siguen siendo
independientes; no hay acciones revisadas por el equipo clínico ni episodios (apertura/cierre); las lecturas del smartwatch se guardan en
el navegador y no se envían a la API ni al LLM.

## Disponible

- Vista de astronauta con presión sistólica, SpO2, contexto diario y autorreporte.
- Vista de personal médico con cuatro tripulantes, tendencia y exportación de telemetría.
- Adaptación CSS a escritorio, tablet, celular y pantallas de hasta 300 px. No es una aplicación nativa de reloj.
- Reproducción acelerada: una hora de misión cada cinco segundos. No representa muestreo de sensores cada cinco minutos.
- Monitor Ollama existente: envío manual de la muestra seleccionada y reporte periódico con respaldo ante fallo.
- Catálogo local de 34 reglas, 60 casos y 58 fuentes, obtenido del archivo del equipo. Es una instantánea, no sincronización automática.
- Manifest y service worker para recursos estáticos y datos ficticios. No se cachean rutas de API ni se ejecuta IA sin el servicio Python.

## Procedencia y límites

La fuente está en https://docs.google.com/spreadsheets/d/1YEJ51SdlEczKco_K-ZaAv-mSCbTSxhe0/edit

Las reglas y acciones terapéuticas permanecen en borrador pendiente de revisión médica. El catálogo no ejecuta un motor clínico de 34 reglas.
El monitor IA muestra el nivel del motor oficial (`motor/evaluar.mjs`, D.13); las desviaciones frente al basal aparecen aparte como tendencias de demostración. El catálogo de 34 reglas sigue sin ejecutarse completo.
El cambio de vista es una demostración sin autenticación ni autorización.

La serie original no contiene presión diastólica. Se muestra como ausente y se exporta null.
Presión y saturación son las variables previstas para ingreso automático; actualmente todas las mediciones provienen de archivos simulados.
Los autorreportes usan reloj civil y los datos históricos reloj de misión: se vinculan por tripulante, pero no se fusionan temporalmente ni se envían al LLM.
La detección de red del navegador no confirma disponibilidad de Ollama ni del servidor. Los errores del monitor permanecen visibles.
La instalación y funcionamiento en relojes concretos requieren pruebas en esos dispositivos. NFC continúa sin alcance definido.

## Inicio

Desde la raíz:

```powershell
npm run build --prefix data-kit
python llm-service/service.py --model qwen3:4b
```

Dejar Python ejecutándose y, en otra terminal, abrir Iniciar-KAWSAY.cmd.
La vista está en http://127.0.0.1:4174.
Ollama debe estar ejecutándose y tener descargado el modelo elegido; se puede cambiar con --model.
Los puertos permitidos del frontend son 4173 y 4174, exclusivamente en localhost.

## Próximo trabajo

1. Probar visualmente 240, 390, 768 y 1440 px, y el flujo completo en equipos físicos.
2. Definir dispositivo, transporte, fecha real, calidad y frecuencia del sensor antes de crear ingesta real.
3. Acordar reloj común y política de antigüedad para combinar autorreporte y mediciones.
4. Revisión médica de reglas, precedencias, datos insuficientes y niveles de referencia.
5. Implementar y evaluar motor determinista contra casos aprobados. Revisar errores NEWS2 de las referencias sin modificar silenciosamente el original.
6. Autenticación, persistencia y sincronización multiusuario antes de introducir datos reales.

## Verificación técnica

```powershell
npm test --prefix data-kit
npm run typecheck --prefix data-kit
npm run build --prefix data-kit
python -m unittest discover -s llm-service -v
```

Las pruebas técnicas no constituyen validación clínica ni prueba física en smartwatch.

## Triaje al ingresar (primera tabla del paciente)

- Pantalla **Triage** (solo Medical staff): filiación (nombre, ID, edad, sexo), antecedentes personales y familiares con código CIE-10, medicación habitual, reacciones adversas a medicamentos y funciones vitales (FC, FR, SatO2, T y PA).
- Se guarda en SQL: migración `database/003_triage.sql`, tabla `kawsay.triage_records`, una fila por ingreso. Rutas `POST/GET /api/v1/triage` y `GET /api/v1/triage/:id` (desde la interfaz: `/demo-api/api/v1/triage`).
- Cada lista (antecedentes, medicación, reacciones) exige elementos o marcar "ninguno"; la BD lo vuelve a verificar con CHECK. Solo datos ficticios (`synthetic` obligatorio). `request_id` hace los reintentos idempotentes.
- Pendiente: vincular el triaje con los tripulantes A–D / motor NEWS2, y alertas cruzadas con alergias y medicación.

## Fase cotidiana (cada 24 h)

- Pestaña **Daily check-in** en Report (tipo interno `Smartwatch` con `daily:true`): signos vitales del smartwatch (PA, FC, FR, T, SatO₂ + ACVPU y O₂ suplementario para NEWS2), tutorial paso a paso con contador de FR de 60 s, escala KSS (1–9) y la pregunta "How do you feel?".
- El **basal** (`basal:true`) lo toma solo el **Medical staff antes de la misión** en la pestaña **Basal**; el astronauta no puede crearlo. Cada check-in diario muestra la diferencia contra el basal vigente (informativa, sin umbrales clínicos). Un basal nuevo reemplaza al anterior como referencia.
- Recordatorio cada 24 h: banner en Home (astronauta) y etiqueta "Check-in due / No basal yet" en las tarjetas del médico. No bloquea lecturas extra.
- Salida: bien y sin anomalía → repetir en 24 h. Síntomas → se crea un reporte de síntomas en Alerts. Vitales en nivel PRIORITY (NEWS2 5–6 o un parámetro en 3) → alerta automática; EMERGENCY (≥7) → registro tipo Emergency (banner rojo al médico). SCHEDULED (1–4) no genera alerta.
- Almacenamiento: localStorage del navegador (igual que el resto de reportes). Pendiente: guardarlo en SQL (observaciones) y validar el texto del tutorial con el equipo clínico.

- Las mediciones diarias las toma **un compañero** (para evitar errores): el check-in exige "Measured by (crewmate)" (no puede ser la misma persona) y queda en el registro. El contador de FR de 60 s lo usa el compañero.

## Fase de alerta (3)

Se abre sola al guardar un check-in con síntomas o con vitales en PRIORITY/EMERGENCY, y se puede retomar desde Alerts ("Continue alert phase"). La alerta se crea **antes** del asistente, de modo que el médico la ve aunque no se complete.

1. **Symptoms**: lista M1–M17, "Other (describe)" y "None of these" (exclusiva). Se guardan los códigos M1–M17; los módulos que cuelgan de cada código están pendientes de definir.
2. **NEWS2**: se calcula con los vitales del check-in y el motor. EMERGENCY/PRIORITY → no hay más preguntas (pasos 1, 2 y 5).
3. **Solo si SCHEDULED o SELF-CARE** — tiempo de enfermedad (minutos/horas/días), forma de inicio (brusco/insidioso) y curso (estacionario/progresivo/intermitente).
4. **ALICIA** si hay dolor (preseleccionado con M1, M3, M7, M13 o M16): localización, intensidad 0–10, carácter, irradiación y atenuantes/agravantes. La "A" inicial (antigüedad) es el tiempo del paso 3.
5. **Después**: "seguir vigilando las funciones vitales" — aviso en Home mientras la alerta siga abierta. Sin intervalo definido todavía.

Los detalles se muestran en el detalle de la alerta (también para el médico). Almacenamiento: localStorage, igual que el check-in.

## Fase 4 · Protocolo por nivel, reporte a Tierra y datos faltantes

- **Protocolo por nivel** (último paso de la fase de alerta y vista del médico): EMERGENCY, PRIORITY, SCHEDULED, SELF-CARE e INSUFFICIENT DATA con "Do now / Recheck / Earth / Escalate". SELF-CARE no reporta a Tierra.
- **Reporte a Tierra**: lo notifica un tripulante sano distinto del paciente (`Notified by`). Se guarda en el registro de alerta (`earth`). Prototipo: no transmite nada.
- **Datos faltantes sin bucles**: cada medida tiene "Could not measure (sensor failed)". Si falta algo, se pide **una sola vez** solo lo que falta (con pista del sensor). Si vuelve a fallar o se omite, se envía al médico con los datos disponibles; el médico ve "Missing or erroneous data" y el motor NEWS2 devuelve INSUFFICIENT DATA (R19) sin asignar nivel. Un dato faltante nunca se interpreta como normal.
- **IA** (`POST /api/monitor/case`, `GET /api/monitor/case?id=…`, cuerpo ≤4096 B, lista blanca de campos, asíncrona): el médico es una persona; la IA no diagnostica. Devuelve (a) **recomendaciones de qué hacer** (1–4, para astronauta y doctor), basadas en el nivel NEWS2 y la regla R calculados por el motor (R01…R19), que el LLM no puede cambiar; y (b) **posibles condiciones** (≤3, con motivo), solo visibles para el médico y rotuladas como sugerencia que él confirma o descarta. Con INSUFFICIENT DATA no se aceptan condiciones. Si Ollama falla, el protocolo del motor y el reporte siguen completos. Texto rotulado "AI-generated, not clinically validated".

### Evaluación del dolor (ALICIA) según el tablero de Miro
Aparición (cuándo y cómo empezó; súbito/gradual) · Localización (dónde exactamente; puede señalarlo o es difuso) · Intensidad (EVA 0–10: 0–3 leve, 4–6 moderado, 7–10 severo) · Características (punzante, opresivo, urente, pulsátil, cólico, lancinante) · Irradiación (sí/no y hacia dónde) · Agravantes y atenuantes (opcionales). El médico ve las seis dimensiones por separado y la IA las recibe en la nota del caso. El enlace de ResearchGate no se pudo abrir desde aquí; el contenido sigue la captura del tablero.
