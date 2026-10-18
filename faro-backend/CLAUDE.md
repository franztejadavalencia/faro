# faro-backend

API de FARO: NestJS 10 + TypeORM 0.3 + PostgreSQL 16. Es la fuente de verdad del modelo de
datos y de las reglas de negocio. Mapa general y flujo de trabajo: `../CLAUDE.md`.

- **Una tarea a la vez**, con el flujo de revisión del `CLAUDE.md` raíz
  (`docs/revisiones/<ID>.md`).
- Arquitectura, versiones y convenciones: `../docs/architecture.md`. Qué se porta de SIAP:
  `../docs/base-desde-siap.md`.

## Scripts
| Comando | Qué hace |
|---|---|
| `npm run start:dev` | API en `http://localhost:3000/api` con `.env.development` (`faro_dev`) |
| `npm run lint` / `lint:check` | ESLint + Prettier (con / sin `--fix`) |
| `npm test` | Unit (`src/**/*.spec.ts`), proceso en `TZ=UTC` |
| `npm run test:e2e` | E2E (`test/**/*.e2e-spec.ts`) sobre `faro_test`, en serie |
| `npm run build` | Compila a `dist/` |
| `npm run migration:generate -- src/database/migrations/<Nombre>` | Migración desde las entidades |
| `npm run migration:create -- src/database/migrations/<Nombre>` | Migración vacía (triggers, CHECKs, seeds) |
| `npm run migration:run` / `:revert` / `:show` | Sobre `faro_dev`; con sufijo `:test`, sobre `faro_test` |

Swagger: `http://localhost:3000/api/docs`. Salud: `GET /api/salud`.

## Reglas
- **El esquema solo cambia con migraciones** (`synchronize: false`). Nunca editar una migración
  ya aplicada: se escribe otra.
- **`.env.test` nunca apunta a `faro_dev`**: el setup de los e2e exige que `DB_NAME` termine en
  `_test`. Credenciales reales solo en los `.env.*` ignorados; `.env.example` es la plantilla.
- Una variable nueva de `.env` va a `src/config/env.validation.ts`, a `.env.example` y a
  `architecture.md` §2.
- La conexión se arma solo en `src/database/typeorm.config.ts` (app y CLI).
- Los e2e levantan la app con `test/utils/crear-app.ts` y limpian con `limpiarBase()` en
  `beforeAll`.
- **Sin `any`** en código nuevo de FARO (la regla está en `warn` solo por el código portado).
- `BaseEntity` se importa de `@common/entities`, nunca de `typeorm` (regla de ESLint).
- Aliases por módulo (`@common`, `@seguridad`, `@plataforma`, …, `@database`) en
  `tsconfig.json`, en el bloque `jest` de `package.json` y en `test/jest-e2e.json`: un alias
  nuevo va en los tres.
- Una dependencia nueva se instala exacta (`.npmrc` `save-exact`) y se anota en
  `architecture.md` §1 en la misma tarea.
