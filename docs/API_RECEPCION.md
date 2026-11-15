# Recepción de observaciones — implementación MVP

Esta entrega implementa recepción de datos ficticios y persistencia PostgreSQL.
La interfaz, las reglas clínicas, el RAG y Ollama conservan sus módulos actuales.

## Completado

- POST /api/v1/observations consume el contrato 1.0.
- GET /api/v1/crew-members/{crew_member_id}/observations exige clock_key y permite limit de 1 a 500.
- GET /health indica que el proceso HTTP responde. No equivale a conexión a sensores ni a disponibilidad del motor clínico.
- Identidad comprobada por misión, equipo, pertenencia y usuario.
- Registro de dispositivos y observadores del equipo. Los dispositivos son compartidos por equipo en esta primera versión; una asignación exclusiva por persona requerirá ampliar el modelo.
- Ejecuciones de simulación registradas y separadas de otros relojes.
- Una transacción por envío: un fallo en cualquier persona revierte todo el paquete.
- received_at se genera en el servidor; measured_at y status_at se conservan.
- Reenvío idéntico devuelve 200 y el recibo original; primer envío aceptado devuelve 201.
- Mismo message_id con contenido distinto devuelve 409. Observación repetida en otro mensaje se reutiliza solo si coincide persona y contenido.
- La normalización de contenido ignora el orden de claves JSON, pero conserva el orden de arrays. Reordenar personas u observaciones con el mismo message_id se considera conflicto.
- Token de servicio limitado a una misión. No equivale a login ni a roles de astronauta/médico/Tierra.
- Escucha exclusivamente en 127.0.0.1, sin CORS abierto ni escrituras con Origin de navegador.

## Modelo SQL inicial

missions, users, crews, crew_members, devices, simulation_runs, ingestion_messages y observations.
La persona conserva user_id entre misiones y su participación recibe crew_member_id.
Este modelo cubre identidad e ingesta; los antecedentes, sueño, síntomas, episodios, alertas y órdenes médicas necesitan tablas posteriores.
El registro manual identifica al observador. SQL comprueba su pertenencia al equipo; no verifica que haya completado el tutorial de FR.

## Puesta en marcha con PostgreSQL

### Prueba inmediata sin instalar un servidor externo

Desde la raíz, abrir Probar-KAWSAY.cmd. Compila el panel y la API e inicia
http://127.0.0.1:4180/pruebas.html con PGlite persistente.
El puerto del laboratorio se define exclusivamente en contracts/local-demo.json.
El servidor lee ese archivo al iniciar; el lanzador muestra la misma dirección.
El panel y laboratorio usan rutas relativas, sin puertos incrustados en sus llamadas.
Esta base embebida se guarda en data-kit/.demo-data, excluida de git.
El laboratorio permite envíos individuales y grupales, reintentos, conflictos y consulta del historial.
El panel original queda en la raíz del mismo servidor. Ollama no está iniciado en este modo.
El servicio solo escucha en esta PC. La red entre laptops y PostgreSQL externo siguen pendientes.
No ejecutar dos instancias de demo sobre el mismo directorio de base de datos.
Las solicitudes del navegador pasan por un adaptador de mismo origen; el token interno no se incluye en HTML.

### Servidor PostgreSQL externo

Esta PC no tenía PostgreSQL ni Docker detectables al implementar. Se requiere una base local de demostración y un usuario con permisos para crear el esquema kawsay.
No se ha instalado un servicio de base de datos ni abierto el puerto a la red local.

En data-kit:

1. Copiar .env.example a .env.
2. Sustituir DATABASE_URL por la conexión a una base ficticia. No reutilizar una base clínica.
3. Generar un token aleatorio y copiarlo a KAWSAY_INGEST_TOKEN, sin publicarlo. Un ejemplo de comando que lo muestra solo en tu terminal:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

4. Establecer KAWSAY_MISSION_ID=MISSION-01 y KAWSAY_DEMO_DATABASE=true para usar los ejemplos.
5. Ejecutar:

```powershell
npm run db:migrate
npm run db:seed-demo
npm run build:api
npm run api
```

En otra terminal, dentro de data-kit:

```powershell
npm run send:demo -- individual
npm run send:demo -- group
```

El segundo comando reutiliza las primeras ocho observaciones e incorpora los dos estados del segundo tripulante.
Repetir individual devuelve el recibo original sin duplicar filas.
.env está excluido de git. No introducir DATABASE_URL ni el token en código de navegador ni HTML exportado.

## Respuestas

| Estado HTTP | Significado |
|---|---|
| 200 | Reenvío idéntico o consulta correcta |
| 201 | Nuevo paquete confirmado |
| 400 | JSON o consulta inválida |
| 401 / 403 | Token inválido o misión/origen no autorizado |
| 409 | Conflicto de identificadores |
| 413 / 415 | Tamaño excesivo o contenido no JSON |
| 422 | Contrato, identidad, dispositivo o ejecución inválidos |
| 503 | Operación no completada; no equivale a un recibo de guardado |

## Pruebas

Las pruebas automáticas usan PGlite, motor PostgreSQL embebido, con el mismo SQL y las consultas del repositorio.
Cubren rollback de grupos, reintentos, conflictos, pertenencias, fuentes, tiempos, aislamiento de ejecuciones y respuestas HTTP.
La prueba HTTP llama al manejador mediante Request/Response; no verifica sockets, firewall ni comunicación física entre laptops.

La prueba de concurrencia con un servidor PostgreSQL externo es opcional y requiere KAWSAY_TEST_DATABASE_URL apuntando a una base de pruebas vacía.
Esa prueba crea el esquema y datos ficticios; no borra tablas al terminar. Se debe usar una base nueva para repetirla.
No se ejecuta si falta esa variable. PGlite no sustituye esa comprobación de concurrencia, instalación y red.

## Pendiente

1. Ejecutar contra PostgreSQL externo y comprobar la red local.
2. Definir permisos de cada emisor y roles, cifrado y transporte para acceso desde otros dispositivos.
3. Cargar los perfiles y antecedentes generados con una correspondencia explícita de IDs. Los ejemplos de esta entrega no importan casos del Excel.
4. Definir plazos de ausencia y agrupación antes de calcular un conjunto temporal de valoración.
5. Conectar nuevas lecturas con motor, autorreporte, alertas e IA.

Fuentes técnicas:
- https://node-postgres.com/features/transactions
- https://node-postgres.com/features/queries
- https://www.postgresql.org/docs/current/ddl-constraints.html
