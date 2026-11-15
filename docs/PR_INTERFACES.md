# feat(ui): incorporar las interfaces responsivas de KAWSAY

Base prevista: `Integración`.
Rama de aporte prevista: `interfaces-responsive`, basada en `Datos-|-GENERADOR`.

## Descripción

Incorpora las vistas aprobadas para Astronauta y Personal médico, con el estilo
azul oscuro y cian, navegación adaptable, reportes manuales, historial,
seguimiento de síntomas y exploración corporal esquemática.

`KAWSAY-interfaces.html` contiene el prototipo autónomo; `index.html` es una copia
idéntica como entrada estática. No requiere instalación para abrirse directamente.
Los datos son simulados, los reportes se guardan en el navegador y el selector de
perfil no constituye autenticación. La conexión con sensores y LLM queda pendiente.

La adaptación del proyecto local conserva el panel previo en `/monitor.html`.
No se modifica `main`.

## Verificación

- Navegación, guardado, revisión de reportes, detalles y selección anatómica.
- 48 comprobaciones de distribución: doce vistas en 320, 390, 768 y 1440 píxeles.
- Sin desbordamiento horizontal en esas comprobaciones.
- Compilación local correcta con `npm run build --prefix data-kit`.
- Hash idéntico entre el HTML aprobado y las entradas local y compilada.

## Estado de publicación

El PR todavía no está creado: GitHub devuelve HTTP 403 al crear la rama y al
escribir archivos mediante la integración. La autenticación local de GitHub CLI
también está inválida. Este archivo contiene el texto preparado para el PR,
no representa un PR remoto.
