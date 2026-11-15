# KAWSAY: contexto del proyecto y guía para desarrollar el simulador

## 1. Qué estamos construyendo

KAWSAY es un sistema local para recoger y seguir información de salud de los astronautas durante una misión. Su objetivo es conservar antecedentes, mediciones y autorreportes, identificar cambios mediante criterios definidos y apoyar la atención del personal médico.

Hay tres niveles de uso:

| Nivel | Función prevista |
|---|---|
| Astronauta | Consultar su información, registrar síntomas, recibir un resumen y ver alertas y recomendaciones habilitadas. |
| Personal médico a bordo | Revisar tripulantes y tendencias, atender alertas, registrar indicaciones y seguir cada episodio hasta su cierre. |
| Cabina médica en Tierra | Recibir paquetes acumulados, revisar la evolución y responder con demora. El protocolo y la demora exacta los definirá el responsable de comunicaciones. |

El sistema está pensado para una red local de misión, con dispositivos del traje, reloj, equipos externos y captura manual. En el MVP simulamos estas fuentes usando laptops y datos ficticios.

La interfaz se adapta a reloj, celular, tablet y computadora. Una pantalla de reloj no implica que el reloj mida todas las variables: la capacidad depende del equipo y su integración.

## 2. Cómo encaja tu trabajo

Tu simulador representa las fuentes que producen datos. Debe generar o reproducir observaciones identificadas y enviarlas al backend mediante el contrato común.

| Componente | Responsabilidad |
|---|---|
| Simulador o dispositivo | Producir valores, tiempos y procedencia; informar disponibilidad y calidad. |
| API | Validar el paquete, comprobar identidades, resolver reintentos y guardar. |
| PostgreSQL | Conservar datos y relaciones sin mezclar personas, misiones o escenarios. |
| Motor de evaluación | Aplicar criterios revisados de triaje, tendencias y valoración. Está pendiente de completar. |
| LLM local con Ollama | Explicar información y ayudar a redactar reportes. No mide ni sustituye al motor. |
| RAG | Recuperar protocolos aprobados y sus referencias para apoyar al LLM. Pendiente. |
| Interfaces | Presentar la información apropiada para cada rol. Su conexión con la nueva API sigue pendiente. |

Tu entrega principal es: **una fuente simulada reproducible que envíe paquetes válidos y permita comprobar su guardado y recuperación**.

## 3. Tres conjuntos que debemos mantener separados

1. **Datos generados de tripulantes:** perfiles y evolución ficticia para el seguimiento de la misión. Ya hay cuatro perfiles, 30 días y series horarias.
2. **Casos del Excel:** situaciones aisladas para comprobar respuestas y criterios del motor. No son antecedentes ni mediciones habituales de esos tripulantes.
3. **Reglas y documentación:** especificación propuesta y fundamento del motor. Su presencia en el archivo no equivale a aprobación médica.

Los ejemplos de la nueva API usan dos identidades de demostración. Su correspondencia con los cuatro perfiles del generador todavía debe acordarse y registrarse explícitamente.

## 4. Qué partes existen y qué no debe asumirse

Existe código para el generador, contrato JSON, validador, esquema SQL, API, laboratorio de ingesta, autorreporte de demostración y monitor Ollama aislado.

La recepción individual/grupal, las transacciones y los reintentos fueron probados sobre PostgreSQL embebido. Hay una prueba opcional de concurrencia contra PostgreSQL externo; no está verificada sin un servidor configurado.

La interfaz de usuarios conserva sus propios reportes en el navegador. Todavía no muestra automáticamente las nuevas lecturas de esta API.

El monitor IA genera reportes periódicos sobre su fuente de demostración, pero todavía no consume el nuevo contrato. Reanalizar la misma muestra no crea una lectura nueva.

El servidor local no debe darse por activo por existir el código. Su último arranque fue detenido por revisión automática debido a una conexión externa no identificada. La habilitación estable y la comunicación entre laptops son pendientes separados.

## 5. Tecnología para desarrollar tu parte

Para integrarte con los módulos existentes, usa Node.js y TypeScript. Puedes organizar la lógica como CLI y añadir una pequeña pantalla de control si te ayuda.

- El módulo existente está en data-kit.
- El contrato es JSON; no depende de React ni de una interfaz específica.
- El backend usa Node y el cliente pg para PostgreSQL externo.
- El laboratorio utiliza PGlite persistente para probar SQL sin instalar un servidor externo.
- El servicio Ollama está en Python y es otro proceso.

No necesitas reescribir la API, hacer un segundo motor clínico ni cambiar el diseño de las pantallas para desarrollar el simulador.

## 6. Archivos que debes leer primero

Rutas relativas a la raíz del repositorio:

| Archivo | Para qué sirve |
|---|---|
| docs/CONTRATO_INGESTA_V1.md | Explica las reglas de intercambio. |
| contracts/ingestion-v1.schema.json | Define campos y combinaciones válidas. |
| contracts/examples/individual.json | Paquete completo de una persona. |
| contracts/examples/group.json | Paquete de varias personas y estados de ausencia. |
| data-kit/src/ingestion.ts | Validador parseIngestion. |
| docs/API_RECEPCION.md | API, autenticación, respuestas y límites. |
| database/demo_seed.sql | IDs de misión, equipo, personas, dispositivo y escenario de ejemplo. |
| data-kit/scripts/send-observations.mjs | Cliente mínimo de envío existente. |
| data-gen/generate.py | Generador reproducible de las series históricas. |
| docs/CHECKLIST_IMPLEMENTACION.md | Estado general y pendientes. |

## 7. Identidad de cada envío

| Identificador | Significado |
|---|---|
| mission_id | Misión. |
| crew_id | Equipo de esa misión. |
| user_id | Persona, conservada entre misiones. |
| crew_member_id | Participación de la persona en ese equipo y misión. |
| message_id | Paquete de envío. |
| observation_id | Observación concreta. |
| simulation_run_id | Ejecución independiente de un escenario simulado. |

Los IDs deben existir en el registro de la base y coincidir entre sí. Un envío no crea automáticamente una identidad nueva.

subjects contiene una o varias personas; cada una tiene su lista observations. Un grupo no implica que todas las personas o variables se hayan medido a la misma hora.

## 8. Variables previstas

| parameter | Dato | unit |
|---|---|---|
| hr | Frecuencia cardiaca | bpm |
| rr | Frecuencia respiratoria | breaths/min |
| spo2 | Saturación de oxígeno | % |
| sbp | Presión sistólica | mmHg |
| dbp | Presión diastólica | mmHg |
| temp | Temperatura | Cel |
| consciousness | Estado de conciencia | null |
| on_oxygen | Uso de oxígeno suplementario | null |

on_oxygen es booleano. consciousness admite alert, new_confusion, voice, pain o unresponsive.
El estado alert significa persona alerta; no es una alarma del sistema.

En la lógica final, FR se registra con ayuda de un compañero y un instructivo. En una medición manual, observer_user_id identifica a quien la registra; el sujeto sigue siendo la persona medida.

No inventes diastólica, conciencia u oxígeno suplementario cuando una fuente no los proporcione.

## 9. Disponibilidad, reporte y calidad

Son campos separados:

| Campo | Valores |
|---|---|
| availability | measurable, not_measurable |
| report_status | reported, pending, not_reporting, not_applicable |
| quality | valid, invalid, unknown |

- Lectura recibida: reported, valor presente y measured_at presente.
- Esperando lectura: pending, value=null, measured_at=null, quality=unknown y motivo.
- Medio disponible que no reporta: not_reporting, sin valor ni momento de medición, con motivo.
- Sin medio disponible: not_measurable + not_applicable, sin valor, con motivo.
- Lectura inválida recibida: conserva el valor y la hora, usa quality=invalid y explica el motivo.

source.type puede ser sensor, manual o simulator. Los automáticos requieren device_id y los manuales observer_user_id.
Toda simulación requiere synthetic=true. No etiquetes una lectura generada como proveniente de un sensor real.

Normal/anormal se determina en una evaluación del motor. El simulador controla valores y fallos para poner a prueba ese comportamiento; no impone el resultado clínico.

## 10. Tiempo real y simulación acelerada

Cada observación incluye:

- measured_at: momento original de medición.
- status_at: momento del estado comunicado.
- received_at: lo añade el servidor, no el simulador.

Las fechas deben incluir Z o desplazamiento horario. clock.timezone contiene una zona válida, por ejemplo America/Lima.

Para un escenario acelerado:

- clock.mode=simulation.
- simulation_run_id identifica la ejecución.
- synthetic=true.
- La hora de la observación avanza con el reloj simulado.
- Las esperas de red y los reintentos usan tiempo real, separados del reloj del escenario.

Propuesta para tu control de reproducción: seleccionar tripulante/grupo, inicio, pausa, avance y velocidad. Por ejemplo, a velocidad x12, cinco minutos de misión transcurren en 25 segundos reales. Esta velocidad es una opción de demostración, no un requisito cerrado.

Las series actuales son horarias. Reproducirlas no equivale a producir mediciones nuevas cada cinco minutos. Si generas datos intermedios, deben identificarse como nuevas observaciones sintéticas y conservar un método y una semilla reproducibles.

Los plazos para declarar ausencia y la ventana para agrupar variables siguen pendientes en contracts/timing-policy.draft.json. No conviertas null en un plazo inventado ni apliques automáticamente una frecuencia de sensor a la FR manual.

## 11. API de integración

El servicio directo previsto para tu cliente Node utiliza:

- POST /api/v1/observations.
- Content-Type: application/json.
- Authorization: Bearer con un token de servicio autorizado para la misión.
- GET /api/v1/crew-members/{crew_member_id}/observations?clock_key=simulation:SIM-01&limit=50.

El puerto por defecto de la API directa es 8780, configurable por KAWSAY_API_PORT.
No confundirlo con el laboratorio web, cuyo puerto se lee de contracts/local-demo.json (actualmente 4180).
El laboratorio usa un adaptador /demo-api para su propia pantalla de pruebas; no es la dirección general que debe usar el simulador externo.

El token debe permanecer en la configuración privada del proceso. No debe aparecer en Git, HTML, capturas ni logs.

La API directa actualmente escucha en 127.0.0.1. Desde tu laptop, localhost significa tu propia laptop, no la PC de Bryan. Para probar entre equipos habrá que configurar el servicio receptor y el acceso de red de manera explícita. No basta con sustituir localhost por cualquier IP.

## 12. Entrega y reintentos

Implementa una cola local de salida:

1. Generar el paquete y guardarlo en la cola antes de transmitirlo.
2. Enviarlo.
3. Conservar el recibo cuando se confirma.
4. Si la conexión falla o no llega respuesta, reintentar el mismo paquete con los mismos IDs y contenido.
5. Usar IDs nuevos solamente para observaciones o mensajes nuevos.

| Resultado | Qué debe hacer el cliente |
|---|---|
| 201 | Registrar el recibo del nuevo paquete. |
| 200 con duplicate=true | Registrar confirmación; no crear una nueva observación. |
| 400, 413, 415, 422 | Mostrar el motivo y revisar el paquete; no reintentarlo sin corrección. |
| 401, 403 | Revisar autorización, misión y configuración. |
| 409 | Señalar conflicto de identificadores; no sobrescribirlo silenciosamente. |
| Error de red o 503 | Mantener pendiente y aplicar reintentos espaciados y acotados. |

Puede ocurrir que el servidor guarde y se pierda la respuesta. Por eso el reintento debe conservar IDs y contenido.
La API acepta un grupo completo o lo rechaza completo; el cliente no debe anunciar guardado parcial.
Las nuevas observaciones pueden reenviarse en otro paquete con otro message_id: solo se reutilizan si coinciden identidad y contenido.

## 13. Orden propuesto para desarrollar

1. Leer contrato y ejemplos; confirmar IDs registrados.
2. Separar módulos de reloj, fuente de datos, empaquetado, cola y transporte.
3. Cargar un ejemplo y validarlo con parseIngestion antes de enviarlo.
4. Enviar una persona y consultar lo almacenado.
5. Añadir envío grupal y lecturas con tiempos independientes.
6. Añadir reproducción acelerada y generación reproducible.
7. Añadir controles explícitos para simular ausencia, lectura inválida y corte de conexión.
8. Probar reintentos, recuperación de cola y conflictos.
9. Documentar comandos, configuración, limitaciones y pruebas.

Una organización sugerida para tu módulo es simulator/: clock, source, packet, outbox y transport. Debe acordarse la ubicación con el equipo antes de integrarlo; esa carpeta aún no forma parte de esta entrega.

## 14. Criterios para dar tu parte por terminada

- [ ] Una persona envía datos y se recuperan del historial correcto.
- [ ] Un grupo conserva la identidad de cada persona y observación.
- [ ] Las unidades y estados respetan el contrato.
- [ ] El reloj acelerado no modifica la hora real de recepción.
- [ ] Repetir un paquete no duplica filas.
- [ ] Un corte conserva la cola y permite reanudar con los mismos IDs.
- [ ] Un paquete rechazado aparece como no guardado y muestra el motivo.
- [ ] Los fallos de equipo se distinguen de los resultados anormales.
- [ ] La ejecución se puede reproducir con la misma configuración y semilla.
- [ ] Hay instrucciones para que otro integrante lo ejecute.

## 15. Coordinación con el resto del equipo

Tu foco propuesto es simulación y transporte de datos. En paralelo se deben trabajar identidad e historia base en SQL, integración de la interfaz, motor revisado, alertas y seguimiento médico.

El equipo médico debe revisar los criterios y acciones. El responsable de comunicaciones define el intercambio con Tierra. El LLM y el RAG se conectarán a datos y documentos identificados, sin mezclar pacientes ni momentos.

Trabajar en una rama propia y proponer PR hacia Integración, sin modificar main. Antes de empezar, confirmar con Bryan que los archivos de esta contribución estén publicados o disponibles en la copia compartida: no asumir que la rama remota ya contiene todo lo descrito.
