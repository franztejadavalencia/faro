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

## Reglas generales

- Si algo en `docs/` contradice lo que se te pide, dilo antes de proceder.
- Si una tarea toca backend y frontend, dilo en el plan: qué cambia en cada lado.
- Al cambiar un contrato de API, actualiza el DTO del frontend y los docs en la misma tarea.
- Al terminar una tarea: tests y lint en verde, marca la tarea en `docs/tasks.md` y propón
  el mensaje de commit.
- SIAP es **solo referencia de lectura** (`--add-dir D:\SIAP`). Nunca modifiques nada ahí.
