# Registro de decisiones — KAWSAY

## D.01 Duración del conjunto sintético: 30 días
- **Fecha: 2026-11-14**
- **Responsable:** Bryan Cayllahua (generador) · Yeremi Camacho (datos/línea base)
- **Estado:** Propuesta
- **Contexto:** La primera versión del generador producía 6 días por astronauta. La línea base personal necesita los primeros 7 días de referencia, así que no se podía calcular la línea base ni quedaban días para evaluar contra ella.
- **Decisión:** Generar 30 días por astronauta (4 astronautas): días 1–7 para la línea base y días 8–30 para evaluación y tendencias. La duración se inspira en el perfil de la misión lunar tipo Artemis IV.
- **Alternativas consideradas:**
  - 10 días (7 base + 3 de evaluación): es suficiente para el cálculo, pero muestra pocas tendencias en la demo.
  - 6 días (versión inicial): descartada porque no cubre la línea base.
- **Consecuencias:** El generador y la línea base deben usar la misma definición de "día 1". El volumen de datos crece (4 × 30 días), lo que no afecta al funcionamiento offline. El escenario es simulado y no representa datos reales de una misión.
- **Fuente:** ESA, ficha de Artemis IV (lanzamiento 2028, duración de 3-4 semanas; corresponde al plan anterior a la reestructuración de 2026): https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Orion/Artemis_IV · NASA, Artemis IV con objetivo a inicios de 2028: https://www.nasa.gov/event/artemis-iv · La duración del plan reestructurado no está confirmada.

## D.02 Mínimo de valores válidos para la línea base: 5 de 7
- **Fecha: 2026-11-14** 
- **Responsable:** Milagros Villegas (validación clínica) · Yeremi Camacho (implementación)
- **Estado:** Propuesta
- **Contexto:** Durante los días 1–7 un sensor puede fallar o una medición puede no registrarse. Si la línea base se calcula con muy pocos valores, la media y la desviación estándar no representan el estado habitual del astronauta. Eso puede generar falsos positivos (alertas sin motivo) o falsos negativos (una σ inflada que oculta un cambio real).
- **Decisión:** Por cada astronauta y cada variable, la línea base se calcula solo si hay al menos 5 valores válidos entre los días 1–7. Si hay menos, la variable se marca como "línea base insuficiente" y no se calcula su puntaje z. Los valores faltantes no se rellenan ni se reemplazan por valores típicos.
- **Alternativas consideradas:**
  - Exigir 7 de 7: un solo día sin medición dejaría al astronauta sin línea base. Es demasiado frágil para un entorno con fallas de sensor.
  - Aceptar con 1 o 2 valores: con 1 valor la desviación muestral no se puede calcular; con 2 resulta muy inestable. Daría puntajes z poco confiables.
  - Rellenar faltantes (imputar con la media o con el valor anterior): descartado porque fabrica datos y viola el principio "faltante ≠ normal".
- **Consecuencias:** La app muestra el estado "línea base insuficiente" para esa variable y la cuenta como abstención. El motor sigue evaluando con NEWS2, que usa umbrales fijos y no depende de la línea base, así que una alarma confirmada no se pierde. El generador debe incluir casos con faltantes en la semana 1 para demostrar este comportamiento.
- **Fuente:** Decisión de diseño del equipo, pendiente de validación. El umbral de 5 no proviene de una guía clínica.