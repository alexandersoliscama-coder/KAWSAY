# Contrato de recepción KAWSAY — propuesta 1.0

Formato común para sensores, simulador y registro manual. No ejecuta triaje.

## Identidad

mission_id es misión; crew_id es equipo; user_id es persona; crew_member_id es su pertenencia al equipo y misión.
subjects admite entre una y cien personas, sin personas ni pertenencias repetidas dentro del envío.
Cada observación lleva observation_id; message_id identifica el paquete. El backend deberá verificar relaciones SQL y permisos; este validador verifica estructura.

## Estados

| Campo | Valores | Texto de pantalla sugerido |
|---|---|---|
| availability | measurable / not_measurable | Medible / Sin medio de medición disponible |
| report_status | reported / pending / not_reporting / not_applicable | Lectura recibida / Esperando lectura / Equipo sin reporte / No corresponde esperar reporte |
| quality | valid / invalid / unknown | Válida / Inválida / Calidad desconocida |

reported requiere valor y measured_at. Sin lectura, ambos son null, quality es unknown y reason explica la ausencia.
not_measurable implica not_applicable. Una lectura inválida conserva valor y motivo, pero no debe utilizarse para clasificar.
La disponibilidad significa capacidad actual de medir. Una FR manual puede ser medible sin device_id.
Normal/anormal se guarda como evaluación separada del servidor con regla, versión y observaciones utilizadas. No lo determina este contrato de recepción.

## Variables

hr (bpm), rr (breaths/min), spo2 (%), sbp y dbp (mmHg), temp (Cel).
consciousness: alert, new_confusion, voice, pain o unresponsive. on_oxygen: booleano. Ambos usan unit=null.
Los dominios numéricos son técnicos; no son intervalos de normalidad clínica.
source.type es sensor, manual o simulator. Automáticos requieren device_id; manual requiere observer_user_id, que puede ser el compañero que mide FR.

## Tiempo y procedencia

measured_at es la hora original de medición; status_at, la hora del estado comunicado. Todas las fechas incluyen zona o Z.
El servidor añadirá received_at sin reemplazar measured_at.
clock.timezone usa una zona válida como America/Lima. Cambiar la presentación no cambia el instante.
simulation requiere simulation_run_id y synthetic=true. Sus fechas pertenecen al escenario acelerado; no se mezclan con reloj real ni con otras ejecuciones.
real usa simulation_run_id=null; permite datos sintéticos con reloj real.
Omitir un parámetro significa que ese envío no lo actualiza: no indica normalidad ni ausencia.

## Tiempos aún no acordados

contracts/timing-policy.draft.json deja null los plazos por variable y la ventana de agrupación. Significa pendiente, no cero ni infinito.
No se activa detección automática de equipo sin reporte ni agrupación temporal con valores por defecto.
La FR manual no hereda automáticamente la frecuencia del sensor.

## Entregables

- contracts/ingestion-v1.schema.json: esquema JSON Schema 2020-12.
- contracts/examples/individual.json: ejemplo completo con FR por compañero.
- contracts/examples/group.json: dos personas, incluyendo estados de ausencia.
- data-kit/src/ingestion.ts: parseIngestion(input), valida y devuelve una copia; ante errores rechaza el paquete completo.
- data-kit/tests/ingestion.test.ts: identidad, duplicados, unidades, estados y relojes.

El esquema describe estructura y combinaciones; el validador añade calendario, zona horaria, orden temporal y duplicados.

## Integración siguiente

API implementada: POST /api/v1/observations con JSON, inicialmente en loopback y solo para datos ficticios. Ver API_RECEPCION.md.
Validar todo antes de guardar en una transacción; verificar pertenencias, autorización y conflictos de reintento.
Reenvíos deben conservar identificadores y contenido. Un ID repetido con distinto contenido debe rechazarse.
La persistencia e idempotencia entre paquetes están implementadas en el repositorio PostgreSQL; requieren conectar una base y aplicar la migración. El validador del contrato por sí solo no persiste.
No se cambia el exportador histórico ni la interfaz trabajada en otra pestaña. El monitor Ollama todavía no consume este nuevo contrato.
