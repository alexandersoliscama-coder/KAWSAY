# Interfaces HTML aprobadas

`KAWSAY-interfaces.html` es la fuente de la nueva interfaz adaptable a celular,
tablet y computadora. Incluye perfiles Astronauta y Personal médico, reportes
manuales con almacenamiento local, seguimiento, historial y exploración corporal.

La entrada raíz `index.html` conserva una copia idéntica para abrir o servir
directamente el prototipo sin instalar dependencias. Tras modificar la fuente,
actualiza esa copia con `Copy-Item KAWSAY-interfaces.html index.html`.

En el proyecto local existente:

```powershell
npm run build --prefix data-kit
npm run preview --prefix data-kit
```

- `/`: nueva interfaz HTML.
- `/KAWSAY-interfaces.html`: la misma interfaz.
- `/monitor.html`: panel anterior de datos y conexión con el servicio de análisis.

También se puede abrir `index.html` directamente en el navegador. El nuevo HTML
es una maqueta funcional independiente: sus datos son simulados y no está conectado
a sensores, al LLM ni a un equipo médico. Los reportes se guardan únicamente en el
navegador de origen. El cambio de perfil no es autenticación. La anatomía es esquemática.

Comprobado: navegación, guardado de reportes, revisión de seguimiento y detalles.
Las doce combinaciones de perfil y vista se revisaron en anchos de 320, 390, 768 y
1440 píxeles sin desbordamiento horizontal (48 comprobaciones de distribución).

Destino de publicación del aporte: `Datos-|-GENERADOR`; integración posterior
mediante PR hacia `Integración`. No publicar sobre `main`.
