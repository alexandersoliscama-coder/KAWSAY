# Aporte de datos y generador

Liu Bryan Cayllahua Huaringa · KUNTUR X · 14 de noviembre de 2026.

## Recuperado del ejercicio previo

Generador Python y cuatro pruebas; catálogo/modelo del check-in; adaptador
localStorage; formulario React con revisión, confirmación, historial y exportación;
y seis pruebas React de comportamiento. Se separaron los tipos del antiguo motor.
La captura se trasladó de `kawsay-core` del ejercicio a `data-kit` para no imponer
el núcleo clínico de práctica a las ramas Motor y UI.

## Añadido para integrar

- Manifiesto con semilla, versiones, unidades, resoluciones y hashes.
- Verificación `--check` sin sobrescribir datos.
- Correspondencia DEMO-01…04 ↔ A…D.
- Carga/validación de archivos y detección de duplicados.
- Selección por persona/día/hora y ambiente unido por módulo.
- Adaptadores propuestos, procedencia y ausencia de datos preservadas.
- Vista que realmente carga las series, con botones para los escenarios.
- Preparación PowerShell y comprobaciones de GitHub Actions.

## Límites y siguiente integración

Este aporte no implementa NEWS2, decisiones clínicas, autorización de EVA, envío
remoto, Earth Packet o service worker. El formulario funcional no es una escala
validada. Usa localStorage, no IndexedDB; está dirigido a datos ficticios en una
pestaña. Motor debe revisar el contrato antes de consumirlo y UI integrar el
componente en la PWA final. El simulador y el motor de práctica no se importaron
como reglas aprobadas para el equipo.

## Comprobaciones

Raíz: `python -m unittest discover -s data-gen -v` y
`python data-gen/generate.py --check`. En `data-kit`: `npm ci`, `npm test`,
`npm run typecheck`, `npm run build`. Incluyen escenarios reales del generador,
ID mapping, datos faltantes, recuperación, duplicados y fallos de guardado/carga.
Estas comprobaciones técnicas no acreditan validación clínica o espacial.

Verificado localmente con Python 3.11.9 y Node 24.18.0 en Windows: seis pruebas
Python, doce pruebas Vitest, smoke test del modelo de captura, revisión TypeScript
y compilación. La vista sirvió HTML y cuatro perfiles por HTTP correctamente.
No se afirma una prueba visual ni una ejecución offline completa de la PWA.
El workflow está preparado para Windows y Linux; su resultado remoto solo se
conocerá al publicar el commit.
