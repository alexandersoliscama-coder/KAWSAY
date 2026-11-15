# Integración del simulador de Yeremi con la API de Bryan

Fecha: 15 de noviembre de 2026. Datos exclusivamente ficticios.

## Qué se recuperó y qué se modificó

Se recuperaron los 23 archivos de `simulator/` de la rama `sim/08-demo-completa`,
commit `063e05ba57353d7b63b8c487df6b8e768c445042`, del repositorio del equipo:
https://github.com/alexandersoliscama-coder/KAWSAY/tree/063e05ba57353d7b63b8c487df6b8e768c445042/simulator

El desarrollo original del simulador corresponde a Yeremi. Esta integración añade:

- Lectura de `contracts/generated-crew-map.json`, sin duplicar A–D en config.json.
- Rechazo de correspondencias de otra misión/equipo o identidades repetidas.
- Lectura de fuentes independiente de la carpeta desde donde se ejecuta Node.
- Transporte con una función de envío inyectable para probar el receptor real sin sockets.
- Directorio de outbox configurable con `KAWSAY_OUTBOX_DIR`; las pruebas usan uno temporal.
- Pruebas con `parseIngestion`, el receptor real, las migraciones SQL y perfiles A–D.
- Arranque de la API real en 8780 con PostgreSQL embebido mediante `api:embedded`.

`simulator/` es el generador/emisor de Yeremi. `data-kit/simulator/` es el prototipo
visual anterior: son módulos diferentes. No se afirma que el HTML ya consuma esta API.

## Respuestas encontradas

| Pregunta | Evidencia y respuesta |
| --- | --- |
| ¿Quién tiene el motor anterior? | `liubryan123-hash/kawsay`, carpeta `kawsay-core/`. Su README identifica a Yeremi Camacho como responsable. |
| ¿Ese motor calcula NEWS2? | No. El README indica que recibe `news2.total` y `news2.max_param_score` calculados por el flujo de datos. |
| ¿Hay algún cálculo NEWS2 local? | El prototipo recuperado contiene un ensayo de escala 1 en `data-kit/simulator/`; ver `docs/simulador/AVANCE_INTEGRADO.md`. No equivale a integración oficial ni a reglas aprobadas. |
| ¿Quién hizo las pantallas de triaje/evaluación? | El núcleo anterior incluye `src/ui/EventTriage.tsx` y `src/ui/Evaluation.tsx`, bajo la responsabilidad indicada de Yeremi. Son distintas de las interfaces generales de astronauta/médico. |
| ¿Quién está conectando la interfaz general a SQL? | No se encontró una asignación confirmada ni una conexión implementada en el código revisado. Sigue pendiente. |
| ¿Quién tiene el contenido clínico? | El núcleo tiene la plantilla `data/KAWSAY_clinical_content.xlsx` y convertidor. Su README indica contenido pendiente; no se confirmó un Excel final aprobado. |
| ¿El dispositivo SIM-SUIT-01 está registrado? | Sí, en `database/demo_seed.sql`, junto con MISSION-01, CREW-01 y SIM-01. |
| ¿Quién registra A–D? | `importGeneratedProfiles` usa el mapa compartido. El arranque embebido aplica migraciones, semilla e importación antes de aceptar envíos. |

Fuente del núcleo anterior, consultada en el commit `6d5bc637a0244904b825167dacf447d1c72963c5`:
https://github.com/liubryan123-hash/kawsay/blob/6d5bc637a0244904b825167dacf447d1c72963c5/kawsay-core/README.md

El chat del grupo contiene un mensaje anterior con 55 pruebas y contenido clínico
pendiente. Es un antecedente, no prueba de que ese código esté integrado en el repositorio actual.

## Prueba reproducible sin servidor ni puertos

Desde `data-kit/`:

```powershell
npm ci
npm test -- --run tests/simulator-integration.test.ts
npm run typecheck
npm run build:api
```

La suite valida 720 paquetes grupales horarios y cinco estados del equipo: 725 en total.
Ejercita el transporte de Yeremi contra `createHandler`, `ObservationStore` y PGlite:
201 inicial, 200 duplicado, 409 conflicto, 422 rechazo, 401 token, historial separado,
reversión transaccional y outbox durante corte/pérdida de confirmación.

En el modo normal de prueba se inyecta una llamada al receptor real dentro del mismo
proceso. No es la API falsa, pero tampoco demuestra conectividad TCP ni entre laptops.

Para ejecutar la misma suite por HTTP loopback, en un entorno que permita sockets:

```powershell
$env:KAWSAY_TEST_HTTP = "true"
npm test -- --run tests/simulator-integration.test.ts
Remove-Item Env:KAWSAY_TEST_HTTP
```

La prueba HTTP se intentó en esta sesión y fue bloqueada con EACCES. No se declara aprobada.

Resultado final de comprobaciones locales: 49 pruebas Vitest aprobadas y una de
concurrencia PostgreSQL externa omitida; 18 pruebas Node del prototipo visual aprobadas;
TypeScript, compilación de API y compilación de interfaz correctas. Las seis pruebas
nuevas de integración están incluidas en las 49 de Vitest.

## API en 8780 sin instalar PostgreSQL

Requiere Node 24.13 o superior y las dependencias de desarrollo, incluido PGlite.
Desde `data-kit/`, instalar y compilar como arriba. Si aún no existe `.env`, copiar
`.env.example` a `.env`; conservar cualquier configuración existente.

Configurar localmente, sin compartir el token:

```dotenv
KAWSAY_MISSION_ID=MISSION-01
KAWSAY_API_PORT=8780
KAWSAY_DEMO_DATABASE=true
KAWSAY_INGEST_TOKEN=<token-aleatorio-local-de-al-menos-32-caracteres>
```

Puede generarse un token en la propia terminal con:

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copiarlo solo al `.env` local. No publicarlo ni enviarlo por WhatsApp.
`DATABASE_URL` no se utiliza en este modo; `npm run api` sigue siendo el modo PostgreSQL externo.

Terminal 1, dentro de `data-kit/`:

```powershell
npm run api:embedded
```

Terminal 2, desde la raíz del proyecto:

```powershell
$env:KAWSAY_API_URL = "http://127.0.0.1:8780"
node --env-file=data-kit/.env simulator/simular.mjs --horas 0-3
```

Se esperan cuatro paquetes grupales. Repetir el comando debe producir duplicados
sin insertar las mismas observaciones otra vez. El token debe ser el mismo en ambos procesos.
La base persiste en `data-kit/.ingestion-data/`, ignorada por Git. No abrir dos
instancias sobre ese directorio. El modo solo escucha en 127.0.0.1, en la misma laptop.
El arranque persistente y la conexión entre procesos quedan pendientes de comprobar
en una sesión sin el bloqueo EACCES; la compilación y las pruebas en proceso son comprobaciones distintas.

El dataset es horario. La velocidad de reproducción no convierte esas muestras en mediciones
reales cada cinco minutos ni genera nuevos valores fisiológicos entre horas.

## Orden para continuar

1. Publicar/revisar el contrato, API y SQL; la rama remota `feat/contrato-api-sql`
   se creó, pero el código de ingesta seguía pendiente de subir al revisar esta sesión.
2. Revisar las ramas encadenadas de Yeremi o la rama local de integración. Esta última
   ya contiene una copia de sus archivos: comparar antes de fusionar para evitar duplicarlos.
3. Ejecutar la suite HTTP y el arranque 8780 en una laptop sin el bloqueo local.
4. Confirmar con Yeremi qué versión del núcleo anterior se reutiliza y quién entrega el Excel final.
5. Asignar la conexión de las interfaces generales a perfiles e historial de la API.
6. Incorporar NEWS2 y reglas revisadas; después conectar Ollama al flujo recibido.

No se fusionó main ni se enviaron mensajes al equipo desde esta sesión.
