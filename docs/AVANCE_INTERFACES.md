# KAWSAY — interfaces y estado de integración

Actualizado: 14 de noviembre de 2026.

## Disponible

- Vista de astronauta con presión sistólica, SpO2, contexto diario y autorreporte.
- Vista de personal médico con cuatro tripulantes, tendencia y exportación de telemetría.
- Adaptación CSS a escritorio, tablet, celular y pantallas de hasta 300 px. No es una aplicación nativa de reloj.
- Reproducción acelerada: una hora de misión cada cinco segundos. No representa muestreo de sensores cada cinco minutos.
- Monitor Ollama existente: envío manual de la muestra seleccionada y reporte periódico con respaldo ante fallo.
- Catálogo local de 34 reglas, 60 casos y 58 fuentes, obtenido del archivo del equipo. Es una instantánea, no sincronización automática.
- Manifest y service worker para recursos estáticos y datos ficticios. No se cachean rutas de API ni se ejecuta IA sin el servicio Python.

## Procedencia y límites

La fuente está en https://docs.google.com/spreadsheets/d/1YEJ51SdlEczKco_K-ZaAv-mSCbTSxhe0/edit

Las reglas y acciones terapéuticas permanecen en borrador pendiente de revisión médica. El catálogo no ejecuta un motor clínico de 34 reglas.
El monitor mantiene sus reglas estadísticas de demostración. No se presenta un nivel clínico a partir del catálogo.
El cambio de vista es una demostración sin autenticación ni autorización.

La serie original no contiene presión diastólica. Se muestra como ausente y se exporta null.
Presión y saturación son las variables previstas para ingreso automático; actualmente todas las mediciones provienen de archivos simulados.
Los autorreportes usan reloj civil y los datos históricos reloj de misión: se vinculan por tripulante, pero no se fusionan temporalmente ni se envían al LLM.
La detección de red del navegador no confirma disponibilidad de Ollama ni del servidor. Los errores del monitor permanecen visibles.
La instalación y funcionamiento en relojes concretos requieren pruebas en esos dispositivos. NFC continúa sin alcance definido.

## Inicio

Desde la raíz:

```powershell
npm run build --prefix data-kit
python llm-service/service.py --model qwen3:4b
```

Dejar Python ejecutándose y, en otra terminal, abrir Iniciar-KAWSAY.cmd.
La vista está en http://127.0.0.1:4174.
Ollama debe estar ejecutándose y tener descargado el modelo elegido; se puede cambiar con --model.
Los puertos permitidos del frontend son 4173 y 4174, exclusivamente en localhost.

## Próximo trabajo

1. Probar visualmente 240, 390, 768 y 1440 px, y el flujo completo en equipos físicos.
2. Definir dispositivo, transporte, fecha real, calidad y frecuencia del sensor antes de crear ingesta real.
3. Acordar reloj común y política de antigüedad para combinar autorreporte y mediciones.
4. Revisión médica de reglas, precedencias, datos insuficientes y niveles de referencia.
5. Implementar y evaluar motor determinista contra casos aprobados. Revisar errores NEWS2 de las referencias sin modificar silenciosamente el original.
6. Autenticación, persistencia y sincronización multiusuario antes de introducir datos reales.

## Verificación técnica

```powershell
npm test --prefix data-kit
npm run typecheck --prefix data-kit
npm run build --prefix data-kit
python -m unittest discover -s llm-service -v
```

Las pruebas técnicas no constituyen validación clínica ni prueba física en smartwatch.
