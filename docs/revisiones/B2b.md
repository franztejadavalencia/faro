# B2b · Subir a Nest 11 (decisión 79)

Estado: cerrada <!-- en revisión | aplicando | cerrada -->
Fecha: 2026-10-17

## Objetivo
Subir el backend de Nest 10 a Nest 11 antes de B3 (decisión 79), copiado de `docs/tasks.md`:
`@nestjs/common`, `core`, `platform-express` y `testing` 11.2.x; `@nestjs/config` 4,
`@nestjs/swagger` 11, `@nestjs/typeorm` 11, `@nestjs/cli` y `schematics` 11; `@types/express` 5.
Revisar Express 5 (comodines de ruta, `path-to-regexp` 8, `query parser`) y el orden de lectura
de variables en `config` 4; versiones exactas y anotadas en `architecture.md` §1; S6 de
`pendientes-siap.md` con los números nuevos.

**Listo cuando**: `lint`, `test`, `build`, `migration:run` (y `:test`) y `test:e2e` en verde;
`start:dev` levanta y `/api/salud` y `/api/docs` responden; `npm audit --omit=dev` con **2 o
menos** (solo `js-yaml` de `@nestjs/swagger`). Más el paso 4 del flujo de revisión.

Solo backend, sin cambios de código de negocio ni de contrato de API (B2b no agrega rutas). El
frontend no cambia. Nest 12 queda fuera (decisión 79).

## Plan

1. **Línea base antes de tocar nada** (para comparar): `lint`, `test`, `build`,
   `test:e2e`, `npm audit --omit=dev` (esperado: 15 hallazgos) y `GET /api/docs-json` guardado en
   el scratchpad. Si algo ya está en rojo antes de subir, lo anoto y paro.

2. **Instalar** (un solo `npm install --save-exact`, para que el árbol se resuelva una vez):
   | Paquete | De | A (última 11.x en npm hoy) |
   |---|---|---|
   | `@nestjs/common`, `core`, `platform-express` | 10.4.17 / 10.4.4 / 10.4.17 | **11.2.7** |
   | `@nestjs/testing` (dev) | 10.4.4 | **11.2.7** |
   | `@nestjs/config` | 3.2.3 | **4.0.4** |
   | `@nestjs/swagger` | 7.4.2 | **11.4.7** |
   | `@nestjs/typeorm` | 10.0.2 | **11.0.3** |
   | `@nestjs/cli` (dev) | 10.4.5 | **11.0.24** |
   | `@nestjs/schematics` (dev) | 10.1.4 | **11.1.0** |
   | `@types/express` (dev) | 4.17.21 | **5.0.6** |
   - Peers revisados con `npm view`: `@nestjs/typeorm` 11 acepta `typeorm ^0.3.0` (queda 0.3.31) y
     `@nestjs/swagger` 11 acepta `typeorm ^0.3.0`; `@nestjs/config` 4 pide `@nestjs/common
     ^11.0.1`; `@nestjs/cli` 11 pide Node ≥ 20.11 (tenemos 22). `rxjs` 7.8.1 y `reflect-metadata`
     0.2.2 cumplen. Sin `npm install --force` ni `--legacy-peer-deps`: si un peer falla, paro y lo
     anoto.
   - `typescript` 5.6.3, `jest` 29.7.0, `ts-jest` 29.2.5, `supertest` 7.0.0 y `@types/node` no se
     tocan (decisión 79 no los menciona). Si Nest 11 o `@types/express` 5 exigen una versión
     mayor de TypeScript, lo anoto como pregunta nueva, no lo subo en silencio.
   - `@nestjs/jwt` y `@nestjs/passport` **no se instalan** (llegan en B4): solo reviso sus peers
     para ajustar la tabla de §1 (pregunta 4).

3. **Revisión de Express 5 y Nest 11 contra el código real** (hoy hay poco código Nest):
   - **Comodines de ruta**: `grep` de `'*'`, `forRoutes`, `@All` y rutas con `?`, `+` o `(` en
     `src/` y `test/`. Hallazgo de hoy: **no hay ninguno** (solo `SaludController`); queda
     verificado en el e2e. Regla nueva para `faro-backend/CLAUDE.md`: comodines como `*splat` /
     `{*splat}`.
   - **`query parser`**: Express 5 usa `simple` (antes `extended`), así que `a[b]=1` y `a[]=1` ya
     no se parsean como objeto/arreglo; `a=1&a=2` sigue siendo arreglo. Hoy ninguna ruta lee
     `query`, pero B7, D6, D8 y D10 harán filtros (pregunta 3).
   - **`trust proxy`** (`configurar-app.ts:40`, `app.set('trust proxy', …)`): sigue válido en
     Express 5; verifico con un e2e que `request.ip` respeta `TRUST_PROXY` (hoy está cubierto por
     unit; lo subo a e2e solo si el cambio de versión lo justifica).
   - **`@nestjs/config` 4**: cambia el orden en que `ConfigService.get` resuelve una variable
     (variables validadas/internas antes que `process.env`). FARO lee todo por
     `ConfigService<VariablesEntorno, true>` tras `validarEntorno` (`app.module.ts`,
     `main.ts`, `configurar-app.ts`); `data-source.ts` y el setup de e2e corren fuera de Nest con
     `dotenv` y no se ven afectados. Compruebo que `NODE_ENV=test` + `.env.test` sigue ganando.
   - **Nest 11**: orden inverso de los hooks de cierre (`OnModuleDestroy`…), identidad de módulos
     dinámicos y `ValidationPipe`. FARO no usa hooks de ciclo de vida ni módulos dinámicos propios
     (solo `ConfigModule.forRoot`, `TypeOrmModule.forRootAsync`); verifico que el
     `AuditoriaSubscriber` (que se registra a sí mismo en `dataSource.subscribers` en el
     constructor) y el `ContextoRequestInterceptor` sigan funcionando: el e2e de contexto
     (`test/contexto.e2e-spec.ts`) es la prueba.
   - **Swagger 11**: el plugin de la CLI (`nest-cli.json`, decisión 78) cambia con `@nestjs/cli`
     11; comparo `/api/docs-json` contra la línea base del paso 1.
   - **`@nestjs/cli` 11 / `nest start --watch`** con `cross-env`: `start:dev` debe seguir
     compilando con aliases (decisión 65).

4. **Pruebas**:
   - Las existentes (`npm test`, `npm run test:e2e`) deben seguir en verde **sin cambiar sus
     aserciones**; si una exige cambio, lo anoto en "Resultado" con la causa.
   - E2E nuevo mínimo en `test/` (`express5.e2e-spec.ts`): una ruta inexistente responde
     404 con la forma `{ statusCode, message, error }` por el filtro global; `GET /api/salud`
     200; `GET /api/docs-json` responde y contiene `/api/salud`; y un controlador de apoyo
     (módulo solo de prueba, como ya permite `crearApp(extras)`) que devuelve `req.query` para
     fijar el comportamiento del parser (pregunta 3) y una ruta con `*splat`.
   - Verificación manual: `migration:run` y `migration:run:test` (sin migraciones aún, "No
     migrations are pending"), `start:dev` levanta, `curl` a `/api/salud` y `/api/docs`.

5. **Docs** (releo cada uno justo antes de editarlo):
   - `architecture.md` §1: filas de Nest con las versiones nuevas, `@types/express`, y la nota de
     parches (ya no "quedan 15 hallazgos que solo Nest 11/12 resuelve"); §14: fila 20 nueva
     ("Nest 10.4 → 11.2, decisión 79"); cualquier mención a "Nest 10" en el texto
     (`CLAUDE.md` del backend dice "NestJS 10").
   - `decisiones.md`: la 79 ya está registrada; agrego "(ajustada por 79)" a la 3 si no lo tiene y
     las decisiones nuevas que salgan de las respuestas.
   - `pendientes-siap.md`: S6 con los números de la simulación (15 con Nest 10, 6 con 10.4.19 +
     `overrides`, 2 con Nest 11) y el resultado real de `npm audit` de FARO tras B2b.
   - `base-desde-siap.md`: nota de que lo portado de SIAP (Nest 10) pasa a Nest 11 casi directo.
   - `faro-backend/CLAUDE.md`: "NestJS 11" y una línea con las reglas de Express 5 (comodines,
     `query`).
   - `tasks.md`: marcar B2b.

6. **Cierre**: `lint`, `test`, `build`, `test:e2e`, `npm audit --omit=dev` con el número real y
   `## Resultado` con el commit propuesto. Si el audit da más de 2, lo reporto con la lista y
   paro: no aplico `overrides` ni salto a Nest 12 sin pregunta (decisión 74/79).

## Archivos
- Crear:
  - `faro-backend/test/express5.e2e-spec.ts` (con su controlador de apoyo dentro del mismo
    archivo)
- Cambiar:
  - `faro-backend/package.json` y `package-lock.json`
  - `faro-backend/CLAUDE.md`
  - `docs/architecture.md`, `docs/decisiones.md` (solo anotaciones), `docs/pendientes-siap.md`,
    `docs/base-desde-siap.md`, `docs/tasks.md`
  - Código de `src/` **solo si** una prueba lo exige; cada cambio se anota en "Resultado".

## Lo que encontré
- `tasks.md` ya trae B2b y la decisión 79 está en `decisiones.md` (fila 79). Pide Nest 11.2.x;
  `@nestjs/*` 11 vigentes en npm hoy: core/common/platform-express/testing **11.2.7**,
  swagger **11.4.7**, typeorm **11.0.3**, cli **11.0.24**, schematics **11.1.0**, config
  **4.0.4** y `@types/express` **5.0.6**. Las `latest` de npm ya son la 12 (`common` 12.1.3,
  `config` 12.0.1), por eso cada paquete se instala con versión explícita.
- La decisión 79 escribe "`typeorm` 11": se refiere a `@nestjs/typeorm` 11 (el paquete `typeorm`
  se queda en 0.3.31, decisión 74). Lo interpreto así.
- Lo instalado hoy (`package.json`): `@nestjs/common` 10.4.17, `core` 10.4.4, `platform-express`
  10.4.17, `config` 3.2.3, `swagger` 7.4.2, `typeorm` 10.0.2, `cli` 10.4.5, `schematics` 10.1.4,
  `@types/express` 4.17.21 (coinciden con `architecture.md` §1).
- Superficie de Nest/Express en `src/`: `SaludController` (una ruta `GET salud`), `app.module`,
  `configurar-app.ts` (`setGlobalPrefix`, `ValidationPipe`, `enableCors`, `app.set('trust
  proxy')`), el filtro global, `ContextoRequestInterceptor`, `AuditoriaSubscriber` y las lecturas
  de `ConfigService`. No hay `forRoutes`, comodines, middleware, `req.query` ni
  `@nestjs/passport`. Por eso el riesgo de Express 5 hoy es bajo y el momento, el más barato.
- Los peers de `@nestjs/typeorm` 11 y `@nestjs/swagger` 11 aceptan `typeorm ^0.3.0`;
  `@nestjs/config` 4 pide Nest ≥ 11.0.1.
- Referencia profesional: no aplica a reglas de negocio (es una actualización de dependencias).
  Respalda el criterio la guía de OWASP Top 10 A06:2021 que cita la propia decisión 79.

## Supuestos
- "Nest 11.2.x" de `tasks.md` se cumple con **11.2.7**, la última 11.x de los cuatro paquetes
  del núcleo; no se prueba una 11.3 si existiera.
- El `npm install` puede tocar subdependencias en el lockfile (`express` 5.x, `path-to-regexp` 8,
  `qs`, `body-parser`): eso es lo esperado y es lo que cierra los avisos.
- B3 (ya en `docs/revisiones/B3.md`, en revisión) no cambia por B2b: sus entidades y migraciones
  no dependen del major de Nest. B3 se aplicará después y sobre este árbol.
- El `.env.*` no cambia.
- Sin `overrides` en `package.json`.

## Preguntas
1. **¿Confirmas estas versiones exactas?** `common`/`core`/`platform-express`/`testing`
   11.2.7, `config` 4.0.4, `swagger` 11.4.7, `@nestjs/typeorm` 11.0.3, `cli` 11.0.24,
   `schematics` 11.1.0, `@types/express` 5.0.6. La más dudosa es `swagger`: `tasks.md` solo dice
   "11" y la última 11.x es la 11.4.7 (el plugin de la CLI y los DTO se documentan distinto entre
   minors; la comparación contra `/api/docs-json` lo cubre). Recomiendo estas.
2. **Si Nest 11 o `@types/express` 5 exigen subir `typescript` (hoy 5.6.3), ¿lo subo dentro de
   B2b o paro y pregunto?** Recomiendo **parar y preguntar** (una subida de TypeScript toca
   `ts-jest`, `@typescript-eslint` 8.8.1 y todo el código de B2). Hoy los peers no lo exigen.
3. **`query parser` de Express 5.** Dejar el valor por defecto de Express 5 (`simple`: `?a=1&a=2`
   da arreglo; `a[]=1` y `a[b]=1` ya no) o restaurar `app.set('query parser', 'extended')` para
   mantener el comportamiento de SIAP. Recomiendo **dejar `simple`** y documentar en el
   `CLAUDE.md` que los filtros con listas usan parámetros repetidos o separados por coma:
   `extended` usa `qs`, que es justo donde estaban los avisos de DoS/prototype pollution que
   motivan la decisión 79. ¿Apruebas `simple`? (El código de SIAP que se porte, p. ej.
   `http-params.util.ts` del frontend, se revisa en F3 para que arme así los parámetros.)
4. **`@nestjs/jwt` 12.0.1 de la tabla de §1 (B4).** Su peer cubre Nest 10 y 11, pero la tabla
   declara la versión para Nest 10. Recomiendo **solo revisar su peer en B2b** y dejar la fila
   como está si es compatible; B4 la instala y, si hay una mejor, la anota entonces. `@nestjs/
   passport` 12 (B4, según la decisión 79) lo agrego a la tabla en B4, no ahora. ¿De acuerdo?
5. **Umbral del audit.** El criterio dice "2 o menos (solo `js-yaml` de `@nestjs/swagger`)". Si
   al terminar aparece algún otro hallazgo (p. ej. en `bcrypt`, que llega en B3, no en B2b),
   ¿sigo recomendando parar y registrar en lugar de aplicar `overrides`? Recomiendo **parar**,
   anotar el hallazgo en `pendientes`/`Resultado` y que decidas tú; el `js-yaml` de Swagger
   queda aceptado por la decisión 70 (Swagger apagado en producción).
6. **E2E nuevo (`express5.e2e-spec.ts`).** ¿Te sirve el alcance que propongo (404 con forma
   Nest, `/api/salud`, `/api/docs-json`, parser de `query`, una ruta `*splat` de prueba)?
   Recomiendo **sí**: son las únicas pruebas que fijan el comportamiento de Express 5 para las
   tareas siguientes, y cuestan un archivo. Si prefieres no agregar tests en una tarea de
   dependencias, queda solo la verificación manual.

## Respuestas
<!-- La escribe el usuario. Claude Code no edita esta sección. -->
Revisado el 2026-10-17. Plan aprobado: la línea base antes de subir, un solo `npm install
--save-exact` sin `--force`, parar ante cualquier peer o audit inesperado y comparar
`/api/docs-json` contra la línea base son lo correcto. Verifiqué en npm las versiones y peers del
paso 2. Respuestas y tres agregados:

1. **Versiones: confirmadas** tal como están en la tabla del paso 2. Las 8 existen y sus peers
   cierran con Nest 11.2.7 y `typeorm` 0.3.31. `@nestjs/swagger` 11.4.7 fija `js-yaml` 5.3.0
   (es el aviso que queda, GHSA-r3ph-w7gj-g6xm, rango 5.0.0–5.4.0) y `lodash` 4.18.1 (ya
   corregido). Bien la lectura de "`typeorm` 11" como `@nestjs/typeorm` 11.
2. **TypeScript: para y pregunta**, como propones. Pero hay un detalle que debes verificar:
   `@nestjs/cli` 11.0.24 trae **su propio `typescript` 5.9.3** como dependencia (no peer). Con
   el proyecto en 5.6.3, npm lo deja anidado en `node_modules/@nestjs/cli/node_modules`.
   Comprueba con `npm ls typescript` y `npx nest info` **qué TypeScript usa `nest build` / `nest
   start`** (y por lo tanto el plugin de Swagger). Tiene que ser el 5.6.3 del proyecto, el mismo
   de `ts-jest` y `@typescript-eslint` 8.8.1 (que no soporta TS ≥ 5.7). Anota el resultado en
   "Resultado". Si el build usa 5.9.3, no lo arregles subiendo TypeScript: va a "Preguntas
   nuevas".
3. **`query parser`: `simple`, aprobado.** Precisión para la nota: en el árbol de Nest 11 `qs` ya
   está parcheado, así que el motivo no es el aviso de hoy, sino la superficie: `extended`
   construye objetos anidados desde la URL (contaminación de prototipo y DoS por anidamiento,
   OWASP *Mass Assignment*), y FARO no lo necesita; además es el valor por defecto de Express 5.
   Regla para `faro-backend/CLAUDE.md`: filtros con listas por parámetro repetido
   (`?estado=1&estado=2`); como con un solo valor llega un string y no un arreglo, el DTO del
   filtro normaliza a arreglo con `@Transform` antes de `@IsArray`. Fíjalo en el e2e (un valor
   y dos valores).
4. **`@nestjs/jwt`: de acuerdo.** Solo revisa el peer en B2b y deja la fila. Nota: hoy npm tiene
   `@nestjs/jwt` 12.0.3 (peer `@nestjs/common` 8 a 12); B4 decide la versión. `@nestjs/passport`
   va a la tabla en B4.
5. **Umbral del audit: para y registra**, sin `overrides` ni Nest 12. El `js-yaml` de Swagger
   queda aceptado (decisión 70: Swagger apagado en producción) y se anota así en S6. El audit de
   `bcrypt` es de B3, no de esta tarea.
6. **E2E `express5.e2e-spec.ts`: sí**, con el alcance propuesto más los agregados de abajo.

**Agregados**

- **Guardia de base en `crearApp()`.** B2b cambia cómo `@nestjs/config` 4 resuelve variables
  (internas y validadas antes que `process.env`). El `globalSetup` verifica `DB_NAME` con su
  propio `dotenv`, pero la app de los e2e arma su conexión por `ConfigService`, y es la que
  vacía tablas con `limpiarBase()`. Agrega en `test/utils/crear-app.ts`, tras `app.init()`,
  `asegurarBaseDePrueba(app.get(DataSource).options.database)`, para que la base que verifica el
  setup sea la que usa la app. Una línea; cubre esta subida y las futuras.
- **`trust proxy` en el e2e.** Es la única opción de Express que FARO configura y la decisión 51
  depende de ella. Súbelo a e2e en el mismo archivo: con `TRUST_PROXY` vacío, `x-forwarded-for`
  se ignora; con un valor, se respeta (la ruta de apoyo devuelve `req.ip`). Si armar dos apps con
  distinto `TRUST_PROXY` complica el archivo, basta el caso vacío (el de `.env.test`).
- **`@nestjs/core` y `@nestjs/testing` quedan en la misma versión exacta que `common`** (hoy
  están en 10.4.4 frente a 10.4.17). Verifícalo en el `package-lock.json` tras instalar: ningún
  `@nestjs/*` del núcleo duplicado (`npm ls @nestjs/core @nestjs/common`).


## Preguntas nuevas
<!-- Dudas que aparecen al aplicar. -->
Ninguna.

## Resultado
<!-- Al cerrar: qué se hizo, tests y lint, decisiones registradas, mensaje de commit. -->
> **Nota de reparación (revisión, 2026-10-17):** al escribir este Resultado, la edición
> reemplazó desde el texto "`## Resultado`" del paso 6 del plan hasta el final del archivo y
> borró Archivos, Lo que encontré, Supuestos, Preguntas, Respuestas y Preguntas nuevas. Se
> restauraron desde la copia de la revisión; el Resultado de abajo es el de Claude Code, sin
> cambios.

**Hecho** (2026-10-17): el backend pasa a Nest 11 (decisión 79) con una sola resolución de `npm install`, sin `--force` ni `overrides`. Versiones exactas: `common`, `core`, `platform-express`, `testing` 11.2.7; `config` 4.0.4; `swagger` 11.4.7; `@nestjs/typeorm` 11.0.3; `cli` 11.0.24; `schematics` 11.1.0; `@types/express` 5.0.6 (Express 5.2.1, `path-to-regexp` 8.4.2). `npm ls`: ningún `@nestjs/*` del núcleo duplicado ni peer inválido. `typescript` sigue en 5.6.3.

- **TypeScript de la CLI** (respuesta 2): `@nestjs/cli` 11 anida su propio `typescript` 5.9.3, pero `TypeScriptBinaryLoader` resuelve con `paths: [process.cwd(), …]`, así que `nest build`/`start` (y el plugin de Swagger) usan el **5.6.3** del proyecto, igual que `ts-jest` y `@typescript-eslint` 8.8.1 (comprobado con `require.resolve` desde el cwd). No hubo que subir TypeScript.
- **Línea base vs. Nest 11**: `lint`, 141 unit, `build` y 13 e2e en verde antes; después, igual más 11 e2e nuevos (24). `migration:run` y `:test`: "No migrations are pending". App compilada en el puerto 3100: `/api/salud` 200 `{estado:ok,baseDatos:ok}`, `/api/docs` 200, ruta inexistente 404 con forma Nest, sin errores en el log. `/api/docs-json` idéntico al de la línea base salvo el **orden de las claves** (`summary` cambia de posición); mismo contenido.
- **Express 5**: no había comodines, middleware ni `req.query` en `src/`. Query parser `simple` (respuesta 3), fijado en e2e: `a=1&a=2` es arreglo; `a[b]=1`/`c[]=2` quedan como claves literales; un filtro con `@Transform` acepta uno y dos valores; `estado[]=1` da 400.
- **`@nestjs/config` 4**: sin cambios de código; `.env.test` + `NODE_ENV=test` sigue resolviendo `faro_test`.
- **Agregados de la revisión**: (a) `crearApp()` verifica con `asegurarBaseDePrueba` la base que usa la app tras `app.init()` y cierra la app si falla; (b) `trust proxy` en e2e: con `TRUST_PROXY` vacío se ignora `x-forwarded-for` y con `1` se respeta, en dos archivos porque `ConfigModule` fija las variables al importar `AppModule`.
- **`@nestjs/jwt`**: peer `@nestjs/common ^8 … ^12`, compatible; fila de la tabla sin cambio de versión (B4 confirma).
- **Código de `src/`**: no cambió.
- **Archivos nuevos**: `test/express5.e2e-spec.ts`, `test/express5-trust-proxy.e2e-spec.ts`, `test/utils/controlador-express5.ts`; cambiados `test/utils/crear-app.ts`, `package.json`, `package-lock.json`, `faro-backend/CLAUDE.md`, `architecture.md` (§1, §14 fila 20), `base-desde-siap.md` (regla 10), `pendientes-siap.md` (S6) y `tasks.md`. La decisión 3 ya traía la anotación de la 79; no hubo decisiones nuevas.
- **Tests y lint**: `lint:check` sin avisos; `npm test` 12 suites / 141 tests; `npm run test:e2e` 4 suites / 24 tests; `build` OK.
- **`npm audit --omit=dev`**: 2 moderadas, ambas el `js-yaml` 5.3.0 de `@nestjs/swagger` (GHSA-r3ph-w7gj-g6xm), aceptado por la decisión 70. (Antes: 15; un `npm audit` completo con devDependencies da más, de herramientas de desarrollo.)
- **Aviso**: el `start:dev` que ya estaba corriendo en el puerto 3000 al empezar es anterior a la subida; hay que reiniciarlo.

**Commit propuesto**
```
feat(backend): sube a Nest 11 (B2b)

Nest 11.2.7 sobre Express 5 (decisión 79): config 4, swagger 11, typeorm 11,
cli 11, schematics 11, @types/express 5. npm audit --omit=dev baja de 15 a 2
(js-yaml de swagger). E2E de Express 5 (query simple, *splat, trust proxy) y
guardia de base en crearApp().

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```
