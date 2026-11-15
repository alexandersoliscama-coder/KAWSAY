# Simulador KAWSAY

Envía los signos vitales **ficticios** del generador (`app/public/data/vitals.json`) a la API de ingesta,
usando el contrato `CONTRATO_INGESTA_V1` (sin formato paralelo).

> ⚠️ Todos los datos son sintéticos (`synthetic: true`). No son pacientes reales ni sirven para decisiones clínicas.

## Requisitos

- Node.js 20 o superior (probado con Node 26). No necesita `npm install`.
- Ejecutar todo **desde la carpeta raíz del repo** (`KAWSAY`), no desde `simulator/`.
- En cada terminal nueva:
  ```powershell
  cd C:\ruta\a\KAWSAY
  $env:KAWSAY_INGEST_TOKEN = "solo-mock-local"   # token de la API falsa; el real va en data-kit/.env
  ```

## Inicio rápido (con la API falsa)

**Terminal 1 — la API:**
```powershell
node simulator/api-falsa.mjs
```
**Terminal 2 — el simulador:**
```powershell
node simulator/simular.mjs --horas 0-3
```
Debe mostrar 4 líneas `→ aceptado`, una por hora, con su hora de medición.

## Opciones de `simular.mjs`

| Opción | Valores | Por defecto | Ejemplo |
|---|---|---|---|
| `--dias` | `desde-hasta` (0 a 29) | `0-0` | `--dias 0-6` |
| `--horas` | `desde-hasta` (0 a 23) | `0-23` | `--horas 8-12` |
| `--modo` | `grupo` (un paquete con A-D) o `individual` (uno por tripulante) | `grupo` | `--modo individual` |
| `--velocidad` | segundos simulados por segundo real. `1` = normal, `3600` = 1 h por segundo | `3600` | `--velocidad 1` |

La velocidad solo cambia **cada cuánto** se envía: `measured_at` y `simulation_run_id` no cambian (D.06, D.10).
Ctrl+C detiene la simulación; lo que no se envió queda en la outbox.

## Guion de la demo

| Punto de la demo | Cómo se muestra |
|---|---|
| Enviar una muestra y recuperarla del historial | `node simulator/probar-api-falsa.mjs` (pasos 1 y 5) |
| Reenviarla sin duplicar | `node simulator/probar-api-falsa.mjs` (paso 2 → `200 duplicate: true`) |
| Enviar un grupo sin mezclar personas | `node simulator/probar-transporte.mjs` (historial de A-D con `ajenas: 0`) |
| Conservar pendientes durante un corte y reenviarlas | Apagar la API (Ctrl+C) → `node simulator/probar-outbox.mjs enviar 2 5` → encender la API → `node simulator/probar-outbox.mjs vaciar` |
| Error comprensible cuando la API rechace | `node simulator/probar-fallos.mjs` |
| Instrucciones para ejecutar | Este archivo |

> La API falsa guarda todo en memoria: para empezar de cero, ciérrala (Ctrl+C) y vuelve a abrirla.
> Para simular una API caída que sí responde: `node simulator/api-falsa.mjs --corte` (todo 503).

## Pruebas

| Comando | Necesita la API | Qué comprueba |
|---|---|---|
| `node simulator/probar.mjs` | No | Lectura de `vitals.json` y reloj simulado |
| `node simulator/probar-paquete.mjs` | No | Un paquete individual completo (8 observaciones) |
| `node simulator/probar-grupo.mjs` | No | Paquete de grupo sin mezclar personas |
| `node simulator/probar-estados.mjs` | No | Los 5 estados de equipo del contrato |
| `node simulator/probar-contrato.mjs` | No | Los 725 paquetes cumplen las reglas escritas del contrato |
| `node simulator/probar-api-falsa.mjs` | Sí | 201, 200 duplicado, 409, 401 e historial |
| `node simulator/probar-transporte.mjs` | Sí | Respuestas comprensibles y reintentos (probar también con la API apagada y con `--corte`) |
| `node simulator/probar-outbox.mjs` | Sí | Pendientes durante un corte y reenvío sin duplicar |
| `node simulator/probar-fallos.mjs` | Sí | Unidades incorrectas, datos incompletos, campos faltantes, IDs equivocados, token, conflicto |

## Qué hace cada archivo

| Archivo | Responsabilidad |
|---|---|
| `config.json` | Inicio de la misión, IDs de misión/equipo/ejecución, zona horaria, mapa de tripulantes |
| `source.mjs` | Lee `vitals.json` y la configuración |
| `clock.mjs` | Convierte (día, hora) en fechas ISO del contrato |
| `ids.mjs` | IDs fijos de mensaje y observación (D.09) |
| `sintetico.mjs` | Diastólica sintética determinista (D.08) |
| `estados.mjs` | Los 5 estados de equipo |
| `packet.mjs` | Arma el paquete del contrato |
| `transport.mjs` | Envía, traduce respuestas y reintenta ante cortes |
| `outbox.mjs` | Guarda en `simulator/outbox/` lo que no se pudo enviar y lo reenvía (carpeta ignorada por Git) |
| `simular.mjs` | Programa principal |
| `reglas-contrato.mjs` | Reglas escritas del contrato, como código |
| `api-falsa.mjs` | API de prueba en `127.0.0.1:8781` |

## Respuestas de la API y qué hace el simulador

| Código | Significado | ¿Reintenta? |
|---|---|---|
| 201 | Aceptado | No |
| 200 + `duplicate: true` | Ya estaba guardado | No |
| 409 | Mismo ID con otro contenido | No: se aparta en `outbox/fallidos/` con su motivo |
| 400 / 413 / 415 / 422 | Formato rechazado | No: corregir antes de reenviar |
| 401 / 403 | Token ausente o incorrecto | No |
| 503 o sin respuesta | API no disponible / corte | Sí: 0.5 s, 1 s, 2 s; luego queda pendiente en la outbox |

## Con la API real (pendiente)

Cuando la API de ingesta esté en `main` y encendida (`npm run api`, puerto 8780):
```powershell
$env:KAWSAY_API_URL = "http://127.0.0.1:8780"
node --env-file=data-kit/.env simulator/simular.mjs --horas 0-3
```
El token real se lee de `data-kit/.env` (ignorado por Git). **Nunca** lo escribas en el código, en capturas ni en mensajes.

## Estado

| Parte | Estado |
|---|---|
| Paquetes según el contrato, 8 variables, individual y grupo, 5 estados | ✅ Implementado |
| Transporte, reintentos, outbox, pruebas de fallos (contra la API falsa) | ✅ Implementado |
| Velocidad normal y acelerada (D.10) | ✅ Implementado (`--velocidad`) |
| Validación con `parseIngestion` y prueba contra la API real | ⏳ Pendiente: falta el código de la API en `main` |
| Mapa de IDs leído de `contracts/generated-crew-map.json` | ⏳ Pendiente: hoy es una copia en `config.json` |
| Forma de los cuerpos JSON de respuesta | ⚠️ Supuesta en la API falsa; confirmar con la API real |

Decisiones de diseño: ver `docs/DECISIONES.md` (D.03-D.11).
