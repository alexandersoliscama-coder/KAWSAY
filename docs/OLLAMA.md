# KAWSAY: monitoreo local con Ollama

Esta implementacion es un prototipo con datos ficticios. No es un sistema de
triaje validado ni sustituye el protocolo medico de una mision.

## Funciones y responsabilidades

| Parte | Funcion |
| --- | --- |
| Sensor, simulador o formulario | Proporcionar mediciones; un LLM no mide signos vitales |
| Motor oficial (`motor/evaluar.mjs`, D.13) | Calcular el nivel con NEWS2 al recibir una muestra, sin esperar a la IA |
| Programador Python | Solicitar reportes cada 300 segundos mientras este ejecutandose |
| Ollama | Ejecutar un modelo local y redactar un resumen de los datos proporcionados |
| Catalogo | Limitar las recomendaciones a acciones predefinidas; las obligatorias no se pueden quitar |
| SQLite | Conservar muestras, evaluaciones y reportes entre reinicios |
| Monitor IA | Mostrar avisos y reportes consultando el servicio cada dos segundos |

Modelo inicial propuesto: `qwen3:4b`. El catalogo oficial de Ollama publica una
version cuantizada Q4_K_M de aproximadamente 2.5 GB. Es un candidato para probar
en una laptop de 16 GB de RAM; la latencia y el consumo real deben medirse en el
equipo. No se ha validado su precision clinica. Puede cambiarse con `--model`.

Fuentes tecnicas:
- https://ollama.com/library/qwen3:4b
- https://docs.ollama.com/api/chat
- https://ollama.com/blog/structured-outputs

## Iniciar en Windows

Desde `C:\Users\USUARIO\Proyectos\KAWSAY`, comprueba primero Ollama:

```powershell
ollama list
ollama pull qwen3:4b
```

Si Ollama no esta ejecutandose, abre la aplicacion Ollama o ejecuta `ollama serve`
en una terminal separada. La descarga necesita Internet; la inferencia posterior
usa exclusivamente `http://127.0.0.1:11434/api/chat`.

En una terminal deja el monitor encendido:

```powershell
python llm-service/service.py --model qwen3:4b
```

En otra terminal compila y abre la vista:

```powershell
npm run build --prefix data-kit
npm run preview --prefix data-kit
```

Abre http://127.0.0.1:4173 y entra a **Monitor IA**. Para cambiar la muestra,
selecciona tripulante, dia y hora en **Datos de mision** y vuelve al monitor.
Pulsa **Enviar esta muestra simulada**. El aviso queda almacenado inmediatamente;
el reporte aparece despues de la inferencia. Puedes solicitar otro reporte sin
esperar al siguiente ciclo. Deten los dos servicios con Ctrl+C.

Ejemplo para comprobar el aviso: Ana, dia mostrado 20 (interno 19), hora 12.
El catalogo de recomendaciones se limita a verificar sensores, registrar el
contexto, solicitar revision y obtener datos nuevos. No genera medicamentos ni
dosis como recomendaciones estructuradas. El resumen de texto sigue siendo una
salida de IA sin validacion clinica y puede contener errores.

## Que informacion recibe el modelo

Cada tripulante tiene un contexto separado. Se proporcionan la muestra seleccionada,
hasta seis muestras horarias anteriores o contemporaneas, hasta siete resumenes
diarios sin incluir dias futuros, el ambiente del modulo y el resultado del motor.
Los sintomas diarios no se convierten en sintomas de una hora determinada.
No se mezcla el formulario manual con el reloj de simulacion.

La memoria es la base de datos, no el modelo: cada peticion reconstruye el contexto.
Los reportes anteriores no se introducen como nuevos hechos fisiologicos.
Volver a analizar la misma muestra no significa que se haya vuelto a medir.
Tras cinco minutos sin recibir otra muestra, el panel indica falta de actualizacion.
La edad mostrada corresponde a la recepcion de la muestra, no a su fecha de medicion:
todos estos datos pertenecen a un reloj de simulacion y siempre se muestran como tales.

## Reglas actuales y fallos

El nivel lo calcula el motor oficial (`motor/evaluar.mjs`, D.13) mediante
`node motor/cli.mjs`: NEWS2 y las reglas R01, R02, R03 y R19, todas en borrador.
Si faltan datos, el nivel es `INSUFFICIENT DATA`: medir de nuevo y repetir la
evaluacion. Si ninguna regla aplica, queda `SIN_CLASIFICAR`, que no equivale a
autocuidado. Si el motor no responde (sin Node, error o mas de 15 segundos), el
monitor muestra `MOTOR_NO_DISPONIBLE` y no inventa un nivel.
La desviacion absoluta de tres desviaciones estandar o mas respecto al basal
(HR, RR, SpO2 o temperatura) se muestra aparte como tendencia de demostracion;
no cambia el nivel.

Los avisos estan guardados antes de llamar a Ollama. Un error, timeout de 45 segundos,
JSON invalido o recomendacion ajena al catalogo produce un reporte de respaldo;
las alertas no desaparecen. Un unico hilo evita inferencias superpuestas. Los
reportes son solicitados cada cinco minutos y se publican al terminar; hay latencia
de inferencia. Con cuatro tripulantes se procesan de forma secuencial.

El servicio recupera la ultima muestra de cada tripulante al reiniciar. Puede
consultar su historial en `llm-service/runtime/monitor.sqlite3`, excluido de git.
El monitor muestra el reporte correspondiente a la muestra actual, nunca un
reporte anterior asociado a otra muestra.

## API local del prototipo

| Metodo/ruta | Entrada/salida |
| --- | --- |
| `GET /api/monitor/state` | Muestras actuales, avisos, ultimo reporte de cada muestra y catalogo |
| `POST /api/monitor/demo` | JSON `{"crewId":"A","day":19,"hour":12}`; carga datos sinteticos del repositorio |
| `POST /api/monitor/report` | JSON `{}`; solicita analisis fuera del ciclo |

Python escucha en loopback puerto 8765. La vista de Node reenvia unicamente esas
tres rutas. No se expone Ollama directamente al navegador y no se habilita CORS
global. No hay autenticacion ni cifrado de la aplicacion: usar solo datos ficticios.

## Pendientes para integrar con el equipo

1. Ingesta real: sello de tiempo, unidades, calidad, identificador de muestra y
   limites de antiguedad especificos de cada variable; mediciones al menos cada
   cinco minutos si ese es el requisito. Los datos de hoy son horarios.
2. Conectar el autorreporte mediante el adaptador existente y un reloj de mision
   acordado, conservando su procedencia. El formulario actual sigue separado.
3. Revision clinica de las reglas del motor oficial y protocolos aprobados.
   El nivel ya se calcula en cada lectura con el motor oficial (D.13), sin
   esperar al reporte periodico.
4. Base de conocimiento con documentos aprobados, version, fuente y referencias
   recuperables para recomendaciones mas especificas. No hay RAG ni grafo implementado aqui;
   el grafo de conocimiento pasa a V3 (D.14).
5. Notificaciones PWA, reconocimiento y escalamiento de alertas: actualmente
   hay avisos en el panel abierto y en la consola, no avisos con la app cerrada.
6. Para probar desde un celular: despliegue en la red local con acceso controlado
   al backend, HTTPS y autenticacion. El servicio actual solo escucha en la laptop.
7. Medir latencia, memoria, fidelidad al dato, omisiones, respuestas incorrectas y
   resistencia a instrucciones dentro de datos. Acordar retencion y privacidad
   antes de usar datos reales. No hay envio a Tierra ni DTN en este prototipo.

## Verificacion

```powershell
python -m unittest discover -s llm-service -v
npm run typecheck --prefix data-kit
npm test --prefix data-kit
npm run build --prefix data-kit
```

Las pruebas usan una respuesta simulada de Ollama: verifican persistencia previa
a la inferencia, respaldo ante fallos, rechazo de recomendaciones desconocidas,
separacion temporal y recuperacion al reiniciar. La prueba con el modelo real
requiere que Ollama sea accesible en el equipo.
