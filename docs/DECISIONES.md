# Registro de decisiones — KAWSAY

Cada decisión registra contexto, alternativas y consecuencias. **Propuesta** = pendiente de acuerdo del equipo; **Aceptada** = acordada; **Reemplazada** = sustituida por otra decisión.

## D.01 Duración del conjunto sintético: 30 días
- **Fecha:** 2026-11-14
- **Responsable:** Bryan Cayllahua (generador) · Yeremi Camacho (datos/línea base)
- **Estado:** Propuesta
- **Contexto:** La primera versión del generador producía 6 días por astronauta. La línea base personal necesita los primeros 7 días de referencia, así que no se podía calcular la línea base ni quedaban días para evaluar contra ella.
- **Decisión:** Generar 30 días por astronauta (4 astronautas): días internos 0–6 para la línea base y días 7–29 para evaluación y tendencias (numeración según D.03). La duración se inspira en el perfil de la misión lunar tipo Artemis IV.
- **Alternativas consideradas:**
  - 10 días (7 base + 3 de evaluación): es suficiente para el cálculo, pero muestra pocas tendencias en la demo.
  - 6 días (versión inicial): descartada porque no cubre la línea base.
- **Consecuencias:** El generador y la línea base deben usar la misma numeración de días (ver D.03). El volumen de datos crece (4 × 30 días × 24 horas = 2880 registros), lo que no afecta al funcionamiento offline. El escenario es simulado y no representa datos reales de una misión.
- **Fuente:** ESA, ficha de Artemis IV (lanzamiento 2028, duración de 3-4 semanas; corresponde al plan anterior a la reestructuración de 2026): https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Orion/Artemis_IV · NASA, Artemis IV con objetivo a inicios de 2028: https://www.nasa.gov/event/artemis-iv · La duración del plan reestructurado no está confirmada.

## D.02 Mínimo de valores válidos para la línea base: 5 de 7
- **Fecha:** 2026-11-14
- **Responsable:** Milagros Villegas (validación clínica) · Yeremi Camacho (implementación)
- **Estado:** Propuesta
- **Contexto:** Durante los días 0–6 un sensor puede fallar o una medición puede no registrarse. Si la línea base se calcula con muy pocos valores, la media y la desviación estándar no representan el estado habitual del astronauta. Eso puede generar falsos positivos (alertas sin motivo) o falsos negativos (una σ inflada que oculta un cambio real).
- **Decisión:** Por cada astronauta y cada variable, la línea base se calcula solo si hay al menos 5 días válidos entre los días 0–6. Si hay menos, la variable se marca como "línea base insuficiente" y no se calcula su puntaje z. Los valores faltantes no se rellenan ni se reemplazan por valores típicos.
- **Alternativas consideradas:**
  - Exigir 7 de 7: un solo día sin medición dejaría al astronauta sin línea base. Es demasiado frágil para un entorno con fallas de sensor.
  - Aceptar con 1 o 2 valores: con 1 valor la desviación muestral no se puede calcular; con 2 resulta muy inestable. Daría puntajes z poco confiables.
  - Rellenar faltantes (imputar con la media o con el valor anterior): descartado porque fabrica datos y viola el principio "faltante ≠ normal".
- **Consecuencias:** La app muestra el estado "línea base insuficiente" para esa variable y la cuenta como abstención. El motor sigue evaluando con NEWS2, que usa umbrales fijos y no depende de la línea base, así que una alarma confirmada no se pierde. El generador o el simulador deben incluir faltantes en la semana 1 para demostrar este comportamiento. **Pendiente:** los datos son horarios (ver D.07), así que falta definir cuándo un día cuenta como válido (por ejemplo, un mínimo de mediciones horarias válidas).
- **Fuente:** Decisión de diseño del equipo, pendiente de validación. El umbral de 5 no proviene de una guía clínica.

## D.03 Convención de días: el día 0 es el primer día de la misión
- **Fecha:** 2026-11-15
- **Responsable:** Yeremi Camacho (datos/simulador) · Bryan Cayllahua (generador)
- **Estado:** Propuesta
- **Contexto:** D.01 y D.02 hablaban de "días 1–7", pero el generador numera desde 0: `vitals.json` contiene los días 0 a 29 (verificado con `scripts/inspeccionar.py`: día mínimo 0, día máximo 29). Si cada módulo cuenta distinto, la línea base tomaría 6 días en vez de 7 o quedaría desfasada un día.
- **Decisión:** Todo el código usa los días internos 0–29 tal como los produce el generador. La línea base usa los días 0–6. Solo la interfaz muestra "Día 1–30", sumando 1 al día interno en un único lugar.
- **Alternativas consideradas:**
  - Cambiar el generador para numerar 1–30: obliga a regenerar los datos y a modificar código ya integrado.
  - Que cada módulo convierta a su manera: es justamente la causa del error que se quiere evitar.
- **Consecuencias:** D.01 y D.02 quedan corregidas a "días 0–6" (línea base) y "días 7–29" (evaluación). El simulador calcula la fecha con el día interno (día 0 = fecha de inicio, ver D.06). Todo texto para usuarios debe sumar 1.
- **Fuente:** `app/public/data/vitals.json` y la salida de `scripts/inspeccionar.py` · Instructivo KAWSAY, §5 "Convenciones compartidas".

## D.04 El simulador no envía datos derivados ni campos fuera del contrato
- **Fecha:** 2026-11-15
- **Responsable:** Yeremi Camacho (simulador)
- **Estado:** Propuesta
- **Contexto:** Cada registro de `vitals.json` incluye, además de las mediciones, los puntajes `hr_z`, `rr_z`, `spo2_z` y `temp_z` (no hay `sbp_z`) y un `perfusion_index`. El contrato de ingesta v1 solo define 8 variables (`hr`, `rr`, `spo2`, `sbp`, `dbp`, `temp`, `consciousness`, `on_oxygen`) y establece que normal/anormal es una evaluación separada del servidor. Además, no se ha revisado contra qué referencia calculó el generador esos puntajes z (`data-gen/generate.py`).
- **Decisión:** El simulador envía únicamente las 8 variables del contrato. No envía `hr_z`, `rr_z`, `spo2_z`, `temp_z` ni `perfusion_index`.
- **Alternativas consideradas:**
  - Enviar los puntajes z junto con las mediciones: mezcla datos medidos con datos calculados y deja la línea base (D.02) sin control sobre su propio cálculo.
  - Pedir que el contrato agregue esos campos: crea un formato paralelo para algo que no es una medición.
- **Consecuencias:** Los puntajes z los calcula el módulo de línea base o el motor, a partir de mediciones guardadas y según D.02. `perfusion_index` queda fuera hasta que el equipo decida si es una variable necesaria; en ese caso se agrega primero al contrato.
- **Fuente:** `docs/CONTRATO_INGESTA_V1.md` (secciones "Variables" y "Estados") · `app/public/data/vitals.json` · `simulator/packet.mjs`.

## D.05 Correspondencia de identidades entre el generador y la base de datos
- **Fecha:** 2026-11-15
- **Responsable:** Bryan Cayllahua (API/SQL) · Yeremi Camacho (simulador)
- **Estado:** Aceptada (definida por Bryan)
- **Contexto:** El generador identifica a los tripulantes como A, B, C y D, pero el contrato exige `mission_id`, `crew_id`, `user_id` y `crew_member_id`, y la API rechaza identificadores que no estén registrados en la base.
- **Decisión:** A → `GEN-USER-A` / `GEN-MEMBER-A`, B → `GEN-USER-B` / `GEN-MEMBER-B`, C → `GEN-USER-C` / `GEN-MEMBER-C`, D → `GEN-USER-D` / `GEN-MEMBER-D`. Todos pertenecen a `MISSION-01` / `CREW-01`. La correspondencia oficial vive en `contracts/generated-crew-map.json`.
- **Alternativas consideradas:**
  - Usar A–D directamente como IDs: no cumple el contrato, que separa persona (`user_id`) y participación en una misión (`crew_member_id`).
  - Que cada módulo defina su propia tabla: aparecerían IDs distintos para la misma persona.
- **Consecuencias:** El simulador usa los IDs completos. Mientras `contracts/generated-crew-map.json` no esté en `main`, `simulator/config.json` tiene una copia temporal que se elimina cuando el archivo oficial esté disponible.
- **Fuente:** Respuesta de Bryan del 2026-11-14 · `contracts/generated-crew-map.json` (pendiente de subir a `main`).

## D.06 Reloj de simulación: fecha de inicio y hora de cada observación
- **Fecha:** 2026-11-15
- **Responsable:** Yeremi Camacho (simulador)
- **Estado:** Propuesta
- **Contexto:** El generador solo tiene `day` y `hour`; el contrato exige fechas completas con zona horaria (`measured_at`, `status_at`) y que una simulación se identifique con `simulation_run_id`.
- **Decisión:** La misión simulada empieza el `2028-01-01T00:00:00Z`. `measured_at` = inicio + día × 24 h + hora. `status_at` = `measured_at` + 1 segundo. Los paquetes usan `clock.mode = "simulation"`, `simulation_run_id = "SIM-01"`, `timezone = "America/Lima"` y `synthetic = true`. Estos valores se configuran en `simulator/config.json`.
- **Alternativas consideradas:**
  - Usar la hora actual como `status_at`: un reenvío tendría contenido distinto y la API lo rechazaría como conflicto (ver D.09).
  - Usar el reloj real del contrato (`clock.mode = "real"`): elimina el `simulation_run_id`, que la tarea pide conservar, y mezcla el escenario con el tiempo real.
- **Consecuencias:** Todas las fechas del escenario caen en enero de 2028 (coherente con D.01). `received_at` lo agrega el servidor y no se modifica. La fecha de inicio es un supuesto de demostración y puede cambiarse en la configuración.
- **Fuente:** `docs/CONTRATO_INGESTA_V1.md` (sección "Tiempo y procedencia") · `simulator/clock.mjs` · `simulator/config.json`.

## D.07 Frecuencia de los datos: series horarias, sin interpolar
- **Fecha:** 2026-11-15
- **Responsable:** Yeremi Camacho (simulador)
- **Estado:** Propuesta
- **Contexto:** El checklist del equipo menciona recibir funciones vitales cada 5 minutos, pero el generador produce una medición por hora. Reproducir datos horarios no equivale a medir cada 5 minutos, y fabricar valores intermedios exige un método documentado.
- **Decisión:** Para el MVP, el simulador envía las series horarias tal como las produce el generador. No se generan mediciones intermedias cada 5 minutos.
- **Alternativas consideradas:**
  - Interpolar a 5 minutos: posible, pero cada valor intermedio sería una observación sintética nueva que requiere método, semilla y documentación propios; no cabe en el tiempo del hackathon.
  - Modificar el generador para producir datos cada 5 minutos: multiplica el volumen por 12 y obliga a regenerar todo.
- **Consecuencias:** La demo muestra mediciones horarias, presentadas como tales. La recolección cada 5 minutos queda como trabajo futuro. Un reporte de IA cada 5 minutos no significa que existan mediciones nuevas cada 5 minutos.
- **Fuente:** Guía del simulador de Bryan (sección "Tiempo real y simulación acelerada") · checklist del equipo ("Separaciones que debemos mantener").

## D.08 Variables que el generador no trae: diastólica y estado de conciencia
- **Fecha:** 2026-11-15
- **Responsable:** Yeremi Camacho (simulador)
- **Estado:** Propuesta
- **Contexto:** La tarea pide simular las 8 funciones vitales, pero `vitals.json` no tiene presión diastólica y su campo `alert` es solo verdadero/falso, mientras que el contrato usa `consciousness` con los valores alert, new_confusion, voice, pain o unresponsive. El contrato indica que omitir un parámetro no significa normalidad.
- **Decisión:**
  - **Diastólica:** `dbp` = 65 % de la sistólica, redondeado, más un ajuste entero entre −3 y +3 mmHg. El ajuste se obtiene de un valor pseudoaleatorio que depende solo del identificador de la observación, así que el mismo registro siempre produce la misma diastólica.
  - **Conciencia:** si `alert` es verdadero se envía `consciousness = "alert"`; si es falso, no se envía (no se inventa otro estado).
  - **Oxígeno suplementario:** `on_oxygen` se copia del generador.
- **Alternativas consideradas:**
  - Diastólica con azar real: un reenvío cambiaría el valor y la API lo rechazaría como conflicto (ver D.09).
  - No enviar la diastólica: no cumple la tarea asignada.
  - Traducir `alert = false` a `new_confusion` o `voice`: inventa un estado clínico que el dato no dice.
- **Consecuencias:** Todos los valores se marcan como ficticios (`synthetic = true`, `source.type = "simulator"`). La relación 65 % es una aproximación de diseño para la demostración, no un criterio clínico validado. Si el generador incorpora diastólica o conciencia detallada, esta decisión se reemplaza.
- **Fuente:** `docs/CONTRATO_INGESTA_V1.md` (sección "Variables" y regla sobre parámetros omitidos) · `simulator/sintetico.mjs` · `simulator/packet.mjs`.

## D.09 Identificadores fijos para reenviar sin duplicar
- **Fecha:** 2026-11-15
- **Responsable:** Yeremi Camacho (simulador)
- **Estado:** Propuesta
- **Contexto:** Si un envío falla o se pierde la respuesta, el simulador debe reintentar. El contrato exige que los reenvíos conserven identificadores y contenido, y que un ID repetido con contenido distinto se rechace.
- **Decisión:** Los identificadores se construyen a partir de lo que identifica al dato: `observation_id` = `{simulation_run_id}-{crew_member_id}-d{día}h{hora}-{variable}` (por ejemplo, `SIM-01-GEN-MEMBER-A-d00h00-hr`) y `message_id` = `{simulation_run_id}-msg-{tripulantes}-d{día}h{hora}` (por ejemplo, `SIM-01-msg-ABCD-d00h00`). Todo el contenido del paquete es determinista: no usa la hora actual ni azar real.
- **Alternativas consideradas:**
  - IDs aleatorios (UUID): cada reintento parecería un dato nuevo y se duplicarían registros.
  - IDs fijos con contenido variable (por ejemplo, `status_at` con la hora actual): la API respondería con conflicto (409).
- **Consecuencias:** Reenviar el mismo paquete produce exactamente el mismo JSON, y la API puede responder "duplicado" sin crear filas nuevas. Una nueva ejecución del escenario necesita otro `simulation_run_id` (por ejemplo, `SIM-02`) para no chocar con la anterior.
- **Fuente:** `docs/CONTRATO_INGESTA_V1.md` (sección "Integración siguiente") · `simulator/ids.mjs` · prueba: dos ejecuciones de `probar-paquete.mjs` producen una salida idéntica.

## D.10 Modos del reloj: normal (x1) y acelerado
- **Fecha:** 2026-11-15
- **Responsable:** Yeremi Camacho (simulador)
- **Estado:** Propuesta (implementación pendiente)
- **Contexto:** La tarea pide modo normal y acelerado "conservando la hora de cada medición y el identificador de ejecución". El contrato tiene dos modos de reloj: `simulation`, con `simulation_run_id`, y `real`, sin él.
- **Decisión:** Los dos modos usan `clock.mode = "simulation"` y conservan `simulation_run_id`. La velocidad solo cambia cuánto tiempo real se espera entre envíos: en modo normal (x1) una hora simulada tarda una hora real; en acelerado (por ejemplo, x12) cinco minutos de misión pasan en 25 segundos. La hora de cada medición siempre sale del reloj simulado (D.06).
- **Alternativas consideradas:**
  - Modo normal con `clock.mode = "real"`: pierde el identificador de ejecución, contra lo que pide la tarea.
- **Consecuencias:** Cambiar la velocidad no cambia el contenido de los paquetes, así que se conserva D.09. Las esperas de red y los reintentos usan tiempo real, separado del reloj del escenario.
- **Fuente:** Asignación de tareas del simulador · guía del simulador de Bryan (sección "Tiempo real y simulación acelerada") · `docs/CONTRATO_INGESTA_V1.md`.

## D.11 Rama de integración: `main`
- **Fecha:** 2026-11-15
- **Responsable:** Equipo técnico
- **Estado:** Aceptada (confirmada por el equipo el 2026-11-14)
- **Contexto:** El Instructivo proponía integrar en la rama `Integración`, pero los PR #1, #2 y #3 se fusionaron en `main`, y `Integración` quedó atrasada.
- **Decisión:** Todos los PR se abren hacia `main`. La rama `Integración` deja de usarse.
- **Alternativas consideradas:**
  - Volver a usar `Integración`: obligaría a sincronizarla con `main` y a redirigir los PR ya abiertos.
- **Consecuencias:** Cada cambio llega a `main` por un PR revisado por otra persona; no se sube directo a `main`.
- **Fuente:** Historial de `main` (PR #1, #2 y #3) · acuerdo del equipo del 2026-11-14.
