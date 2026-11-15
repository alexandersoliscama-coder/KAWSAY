# Checklist de implementación KAWSAY

Estados: [x] implementado y comprobado según el alcance indicado; [~] parcial; [ ] pendiente.

## Datos e identidad

- [x] Contrato 1.0: misión, equipo, usuario y pertenencia.
- [x] Envíos individuales y grupales, unidades y procedencia.
- [x] Disponibilidad, reporte y calidad sin convertir ausencias en normalidad.
- [x] Relojes real/simulado separados; política de tiempos aún sin valores acordados.
- [x] Esquema inicial PostgreSQL y migración transaccional.
- [x] Registro de identidades, dispositivos y ejecuciones ficticias para ejemplos.
- [x] Relación explícita de identidades SQL con los cuatro perfiles generados; fixtures del laboratorio separados.
- [~] Historia base versionada e importación de perfiles ficticios. Antecedentes sin registrar; faltan formulario premisión y aprobación médica.

## API y persistencia

- [x] Validación del contrato antes de guardar.
- [x] Verificación de pertenencias y observador manual.
- [x] Recepción atómica de grupos.
- [x] Reintentos sin duplicación y conflictos por contenido o persona.
- [x] Consulta acotada del historial por misión, pertenencia y reloj.
- [x] Token de servicio por misión, proceso local y límites de tamaño.
- [x] Pruebas del SQL sobre motor PostgreSQL embebido.
- [x] Laboratorio local ejecutable con PostgreSQL embebido persistente, envío desde navegador y consulta del historial.
- [ ] Instalar/conectar PostgreSQL externo. No está instalado por esta entrega.
- [ ] Ejecutar prueba externa de concurrencia y flujo HTTP entre equipos.
- [ ] Login y permisos de astronauta, médico y Tierra.

## Seguimiento asistencial

- [~] Captura manual e historial de demostración.
- [ ] Formulario específico de sueño al despertar.
- [ ] Tutorial de FR y registro acompañado integrado.
- [ ] Recepción periódica de nuevas lecturas cada cinco minutos.
- [ ] Motor de triaje y NEWS2 revisado y evaluado con casos del Excel.
- [ ] Episodios, atención de alertas, indicaciones autorizadas y cierre.
- [ ] Protocolo ante falta de respuesta médica.
- [ ] Política de datos faltantes, antigüedad y agrupación.

## IA, comunicación e interfaces

- [~] Servicio Ollama con reportes programados y respaldo; falta probar modelo real y nuevas observaciones.
- [ ] RAG con documentación aprobada y referencias.
- [ ] Reporte longitudinal al médico e informe final.
- [ ] Paquetes acumulativos y comunicación diferida con Tierra.
- [~] Prototipos de interfaz y PWA. Diseño final en otra pestaña: falta verificar integración.
- [ ] Pruebas físicas de reloj, teléfono, tablet y computadora.
- [ ] Publicación confirmada en la rama de integración.

La API nueva todavía no alimenta la interfaz ni el monitor IA. Los casos del Excel se mantienen como banco de pruebas separado.
Detalles y comandos: API_RECEPCION.md.

## Bloque de historia base (15 de noviembre)

- [x] Migración incremental sin eliminar observaciones previas.
- [x] Importación atómica e idempotente con rechazo de conflictos.
- [x] Consulta autenticada de perfiles e historia base por misión.
- [x] Selector de perfiles generados en el laboratorio técnico.
- [ ] Conectar estas consultas a la vista de astronauta y médico.
- [ ] Registrar y aprobar antecedentes reales mediante formulario premisión.

Correspondencias, comandos y reparto para dos personas: HISTORIA_BASE.md.

Verificación: primera ronda del bloque, 42 pruebas aprobadas y una externa omitida; TypeScript y compilaciones correctos. Después se reforzó la relación SQL entre perfil fuente y pertenencia y se añadieron comprobaciones de reversión de migraciones e ingesta de Ana sin mezclar su historial con Ben. La ejecución final quedó bloqueada por revisión automática ante una posible conexión de telemetría a dc.services.visualstudio.com; estos últimos cambios quedan pendientes de verificar. No se inició el servidor en este bloque.

## Última verificación de este bloque

- 34 pruebas Node/Vitest aprobadas; 1 prueba de concurrencia externa omitida por falta de servidor configurado.
- TypeScript correcto.
- Compilación de API y panel correctas.
- No se ejecutó ni se afirma un despliegue HTTP con PostgreSQL externo.

## Laboratorio local disponible

- Puerto centralizado en contracts/local-demo.json: 4180.
- Laboratorio: http://127.0.0.1:4180/pruebas.html
- HTTP comprobado con base embebida persistente: página 200, primer envío 201,
  reintento 200 con duplicate=true, ocho observaciones consultadas.
- Arranque alternativo manual: Probar-KAWSAY.cmd. Usarlo si el proceso de esta sesión ya no está activo.
- Ollama y servidor PostgreSQL externo no forman parte de este modo de prueba.

## Vista destinada a usuarios

- La página principal de la compilación coincide con KAWSAY-interfaces.html:
  perfiles de astronauta y personal médico, reportes, alertas, historial y exploración corporal.
- El panel técnico permanece en /monitor.html y el laboratorio en /pruebas.html.
- Iniciar-KAWSAY.cmd consulta la configuración central del puerto y detecta un servidor existente.
- 35 pruebas aprobadas, incluida navegación de ambas vistas; una prueba de concurrencia externa omitida.
- Estado del último arranque: detenido por revisión automática al detectar una conexión HTTPS externa no identificada. No se afirma que el servidor permanezca activo.
- KAWSAY-interfaces.html es autónomo y permite revisar las vistas sin iniciar Node.
- Las vistas usan datos ilustrativos y guardado local del navegador; la recepción SQL, Ollama y Tierra siguen pendientes de integración con esta interfaz.
