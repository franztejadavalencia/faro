# FARO

Monorepo con dos aplicaciones que forman un solo sistema:

- **`faro-backend/`**: API en NestJS + TypeORM + PostgreSQL. Es la fuente de verdad del
  modelo de datos y de las reglas de negocio.
- **`faro-frontend/`**: SPA en Angular (standalone components, signals). Consume la API.

Cada carpeta tendrá su propio `CLAUDE.md` con su stack y convenciones. Este archivo es el
mapa general: mantenlo corto.

## Documentos de referencia (léelos, no los resumas de memoria)

- `docs/spec.md`: qué hace FARO, usuarios y casos de uso.
- `docs/architecture.md`: stack, versiones, estructura de carpetas y decisiones.
- `docs/decisiones.md`: registro de decisiones (una línea por decisión, con su porqué).
- `docs/base-desde-siap.md`: qué se reutiliza de `D:\SIAP` y cómo adaptarlo.
- `docs/tasks.md`: tareas pequeñas y verificables. Trabaja **una tarea por sesión**.
- `docs/revisiones/<ID>.md`: plan, preguntas y respuestas de cada tarea (ver abajo).

## Flujo de revisión (obligatorio en toda tarea)

Las tareas se revisan fuera de esta sesión, así que **nada importante queda solo en el chat**.

1. **Planificar.** Antes de crear o cambiar archivos del proyecto, copia
   `docs/revisiones/_plantilla.md` a `docs/revisiones/<ID>.md` (ej. `A3.md`) y llénalo:
   plan, archivos, supuestos y preguntas numeradas. Pon `Estado: en revisión` y
   **detente**: avisa que está listo para revisión y no implementes nada más.
2. **Revisión.** El usuario escribe la sección `## Respuestas`, contestando por número. No
   edites esa sección.
3. **Aplicar.** Cuando te pidan aplicar `docs/revisiones/<ID>.md`, lee el archivo completo,
   implementa según las respuestas y pon `Estado: aplicando`. Toda respuesta que sea una
   decisión va también a `docs/decisiones.md`. Si surge una duda nueva, agrégala en
   `## Preguntas nuevas`, vuelve a `Estado: en revisión` y detente.
4. **Cerrar.** Corre `npm audit --omit=dev` en cada app que cambió dependencias (o el
   backend, si la tarea no las tocó) y completa `## Resultado` (qué se hizo, tests y lint,
   resultado del audit, mensaje de commit propuesto), pon `Estado: cerrada` y marca la tarea en
   `docs/tasks.md`. Un parche de seguridad del mismo minor se aplica solo si está en el plan de
   la tarea (decisión 74).

Una tarea muy pequeña (un typo, un ajuste de una línea) puede saltarse el paso 1 si el
usuario lo dice explícitamente.

## Reglas generales

- Si algo en `docs/` contradice lo que se te pide, dilo antes de proceder.
- Si una tarea toca backend y frontend, dilo en el plan: qué cambia en cada lado.
- Al cambiar un contrato de API, actualiza el DTO del frontend y los docs en la misma tarea.
- Al terminar una tarea: tests y lint en verde y el paso 4 del flujo de revisión.
- **Relee un archivo de `docs/` justo antes de editarlo** (no uses lo que leíste al inicio de la
  sesión): se edita también desde otra conversación y podrías deshacer cambios ajenos.
- **Decisiones de negocio con referencia profesional.** En inventario, costos, contabilidad,
  impuestos, fechas y cierres, revisa cómo lo resuelven sistemas profesionales (ERP y POS
  comerciales, normas contables) y cítalo en "Lo que encontré" de la revisión. Si FARO se
  aparta, explica por qué.
- SIAP es **solo referencia de lectura** (`--add-dir D:\SIAP`). Nunca modifiques nada ahí.
  Si encuentras un error o riesgo en SIAP, anótalo en `docs/pendientes-siap.md` (con su
  origen) para corregirlo en una sesión propia de SIAP.
