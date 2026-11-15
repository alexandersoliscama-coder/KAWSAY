# Simulador recuperado y ubicación vigente

Recuperado el 14 de noviembre de 2026 del trabajo previo de Liu Bryan Cayllahua Huaringa con asistencia de Codex. La fuente original estaba en `Documents/Codex/2026-11-13/new-chat/kawsay/kawsay-core`. La recuperación conserva sus fuentes, pruebas y documentos; no inventa el historial Git original.

## Qué abrir

La copia reproducible vigente es `kawsay-simulador.html`, en la raíz del proyecto. Ejecutar `Simulador-KAWSAY.cmd` la regenera desde las fuentes y la abre. También se genera `data-kit/demo/kawsay-simulador.html`: ambos archivos son idénticos y no son versiones diferentes.

Se localizaron en Descargas `kawsay-simulador.html`, `kawsay-simulador (1).html` y `kawsay-simulador (2).html`. Los tres, el original de la conversación y el HTML regenerado tienen 771091 bytes y el mismo SHA-256: `220011621ae0ab15566bc06099515ee0b6438957f0d65b39db5f91f574eae750`. Son copias idénticas, no versiones diferentes. Se conserva un único archivo canónico. La versión recuperada incluye ocho vistas: Tripulación, Evolución, Registro, Casco, Panel médico, Compañero, Earth Packet y Avance.

`KAWSAY-interfaces.html` conserva la interfaz de usuarios del proyecto. `kawsay-simulador.html` es el simulador de práctica. Son entregables diferentes.

## Compilar y comprobar

Desde la raíz, con Node.js >=24.13:

```powershell
npm run demo:simulador --prefix data-kit
npm run test:simulador --prefix data-kit
npm run test:simulador-ui --prefix data-kit
```

El build y las pruebas de dominio usan Node y los cuatro JSON existentes en `app/public/data`. La prueba DOM requiere las dependencias de `data-kit` (`npm ci --prefix data-kit`).

`npm run build --prefix data-kit` también publica la página en `data-kit/dist/kawsay-simulador.html`. Con el laboratorio local activo está disponible en `http://127.0.0.1:4180/kawsay-simulador.html`; el puerto procede de `contracts/local-demo.json`. Usar el mismo origen para conservar el historial local. La persistencia con `file://` depende del navegador.

## Estado de conexión

El simulador guarda registros en localStorage y permite exportar JSON/CSV. No envía observaciones a la API 8780, no utiliza el token de servicio y no escribe en SQL. Earth Packet muestra una cola simulada; no implementa transporte a Tierra. Los botones de ayuda y revisión son flujos locales.

Para construir el emisor real hay que transformar cada toma al contrato `contracts/ingestion-v1.schema.json`, identificar misión/equipo/usuario/pertenencia, registrar dispositivos y ejecuciones, enviar desde un proceso autorizado y comprobar el recibo e historial. La API actual rechaza solicitudes con `Origin` de navegador: el token debe estar en el proceso emisor o un adaptador de servidor.

| Perfil fuente | user_id SQL | crew_member_id SQL |
|---|---|---|
| A | GEN-USER-A | GEN-MEMBER-A |
| B | GEN-USER-B | GEN-MEMBER-B |
| C | GEN-USER-C | GEN-MEMBER-C |
| D | GEN-USER-D | GEN-MEMBER-D |

Estos IDs requieren la importación documentada en [HISTORIA_BASE.md](HISTORIA_BASE.md); no convertir A directamente en un `crew_member_id`. Para API/token consultar [API_RECEPCION.md](API_RECEPCION.md).

## Fuentes y límites

El código está en `data-kit/simulator/`. Su motor de práctica se conserva en `practice-core/` para reproducir el comportamiento recuperado; no sustituye al motor oficial del equipo ni al servicio Ollama. NEWS2 y las reglas se presentan como ensayos técnicos, sin validación espacial ni autorización médica de acciones.

Los documentos originales están en `docs/simulador/` como antecedentes históricos. Sus rutas, puertos, conteos de pruebas y pendientes reflejan aquella sesión. Este documento define la ubicación y los comandos vigentes.
