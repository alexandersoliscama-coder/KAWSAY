## Problema y resultado

KAWSAY tenía la interfaz de demostración en Integración, pero faltaban los módulos locales de datos y recepción. Esta contribución incorpora datos reproducibles, un contrato de envío por misión/equipo/persona y una API que guarda observaciones en PostgreSQL mediante transacciones.

Los envíos individuales y grupales validan identidad, procedencia, unidades y reloj. Un error revierte el paquete completo; un reintento idéntico conserva el recibo sin duplicar observaciones. Cambiar contenido o persona con los mismos identificadores genera un conflicto.

## Incluye

- Generador y cuatro perfiles sintéticos; autorreporte con confirmación, historial y exportación.
- Contrato JSON 1.0, esquema, ejemplos y separación entre disponibilidad, reporte y calidad.
- Esquema SQL inicial, migración, semilla ficticia y consulta acotada de historial.
- API de servicio limitada por misión, solo para datos ficticios.
- Laboratorio persistente con PostgreSQL embebido y configuración central del puerto 4180.
- Integración de compilación con la interfaz HTML ya existente, conservada sin cambios de contenido.
- Monitor Ollama aislado con reportes periódicos, respaldo ante fallos y avisos estadísticos de demostración.
- Documentación de arranque, límites y checklist; comprobaciones de CI para Windows y Linux.

## Validación

- Instalación limpia con npm ci --ignore-scripts.
- 35 pruebas Vitest aprobadas; una prueba externa de concurrencia omitida sin servidor configurado.
- Seis pruebas del generador y seis del servicio Python aprobadas.
- Verificación de los datasets y manifiesto reproducible.
- TypeScript, compilación de API y compilación de interfaz.
- Sin credenciales, bases de ejecución, node_modules, capturas ni logs en el commit.

## Límites de esta entrega

La interfaz de usuario aún usa su propio almacenamiento local; no consume automáticamente la nueva API. Las reglas del Excel son material de referencia y pruebas, no un motor clínico activado ni antecedentes de los tripulantes. RAG, roles autenticados, atención médica con recomendaciones habilitadas y comunicación diferida con Tierra siguen pendientes.

La persistencia y transacciones se probaron con PGlite. Queda pendiente probar PostgreSQL externo y la concurrencia contra ese servidor. El arranque local llegó a responder por HTTP, pero la última ejecución fue detenida por revisión automática debido a una conexión HTTPS externa no identificada; no se afirma un despliegue permanente activo.

Destino propuesto para esta entrega: main, según la solicitud de revisión del equipo. La publicación se hace en feat/contrato-api-sql y no incluye una fusión automática. El historial local parte de la rama de ingesta anterior; antes de fusionar se debe revisar la comparación con main actual.
