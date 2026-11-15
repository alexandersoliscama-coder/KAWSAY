# Perfiles generados e historia base

Este bloque vincula los cuatro perfiles ficticios de `app/public/data/crew.json` con las identidades SQL. El Excel continúa como banco separado de casos para pruebas. Los valores basales del generador no son mediciones premisión ni promedios calculados sobre el seguimiento.

## Correspondencia explícita

Misión `MISSION-01`, equipo `CREW-01`, conjunto `generator-v1-seed42`. La correspondencia editable está en `contracts/generated-crew-map.json`.

| Perfil fuente | Nombre | Alias del prototipo | Usuario SQL | Pertenencia SQL |
|---|---|---|---|---|
| A | Ana | DEMO-01 | GEN-USER-A | GEN-MEMBER-A |
| B | Ben | DEMO-02 | GEN-USER-B | GEN-MEMBER-B |
| C | Carla | DEMO-03 | GEN-USER-C | GEN-MEMBER-C |
| D | Diego | DEMO-04 | GEN-USER-D | GEN-MEMBER-D |

El alias del prototipo solo documenta la equivalencia; no conecta automáticamente la interfaz con SQL. `Lab` y `Hab` indican ubicación, no equipo. Las identidades `MEMBER-01/02` de los ejemplos de ingesta siguen siendo fixtures separados.

## Qué contiene la historia base

- Nombre, edad declarada, sexo y módulo del perfil generado.
- Configuración basal del generador, con procedencia y marca de dato ficticio.
- Antecedentes, alergias, medicación, cirugías y antecedentes familiares en estado `not_recorded`. Una lista vacía en ese estado significa información pendiente.
- Presión diastólica sin valor: el archivo fuente no la proporciona.
- Versión inicial 1, estado `draft` y fecha de registro SQL. La fecha de registro no sustituye una fecha de medición.

La importación es transaccional: un conflicto revierte todo el lote. Repetir el mismo lote reutiliza los registros; cambiar su contenido produce conflicto y exige desarrollar un flujo de revisión. Este importador no sobrescribe historias existentes. No se ha implementado aún el formulario premisión ni la aprobación médica de versiones.

## Migraciones y ejecución

La migración `002_baselines.sql` agrega correspondencias e historias. El ejecutor compartido aplica solo migraciones pendientes, conserva observaciones existentes y revierte el lote si falla. En PostgreSQL externo usa un bloqueo transaccional para serializar migraciones.

Desde la raíz del proyecto, para una base PostgreSQL de demostración ya configurada en `data-kit/.env` con `DATABASE_URL` y `KAWSAY_DEMO_DATABASE=true`:

```powershell
npm run build:api --prefix data-kit
npm run db:migrate --prefix data-kit
npm run db:seed-demo --prefix data-kit
npm run db:import-generated --prefix data-kit
```

El importador externo verifica el hash de `crew.json` contra su manifiesto. Si cambia el generador o sus IDs, hay que revisar y versionar la correspondencia antes de importar.

El modo local embebido aplica migraciones e importa los perfiles al arrancar. Su laboratorio `/pruebas.html` incorpora una sección para consultar perfiles e historia base. La vista principal de astronauta/médico mantiene su funcionamiento actual; todavía no consulta esta API.

## API de lectura

Ambos endpoints requieren el token de servicio y usan exclusivamente la misión configurada para ese servicio:

| Método | Ruta | Resultado |
|---|---|---|
| GET | `/api/v1/crew-members` | Identidades registradas, correspondencias y última versión basal |
| GET | `/api/v1/crew-members/{crew_member_id}/baseline` | Última historia base; 404 si no existe en esa misión |

El token de servicio no sustituye el futuro login por roles.

## Reparto propuesto para dos personas

1. **Nuestro bloque: persistencia y contrato.** Correspondencias, historia base y consultas listas para integración. Siguiente paso: formulario de sueño y conectar la interfaz a la API.
2. **Compañero: simulador y emisor.** Usar estos IDs y el contrato de ingesta; registrar nuevas observaciones y conservar las dimensiones de disponibilidad, reporte y calidad. Puede probar un reloj acelerado con un identificador de ejecución separado.

Punto de encuentro: enviar un paquete de Ana con `GEN-USER-A` y `GEN-MEMBER-A`, consultar su historial y comprobar que no aparece en el de Ben. Para FR manual, el observador debe ser un usuario registrado del mismo equipo. El tutorial de FR y las reglas clínicas todavía están pendientes.

La comprobación de este bloque se realiza con PostgreSQL embebido, pruebas de API en memoria y compilaciones. No acredita un servidor externo instalado, un despliegue HTTP activo ni validación clínica.
