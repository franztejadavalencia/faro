# faro-backend

API de FARO: NestJS 11 + TypeORM 0.3 + PostgreSQL 16. Es la fuente de verdad del modelo de
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
  ya aplicada: se escribe otra. Se escriben a mano, pero **la entidad declara todo lo que TypeORM
  puede ver** (`@Check`, `@Index(..., { where })`, nombres explícitos de PK, FK e índices; el
  índice de expresión `lower(usuario)` lleva `@Index('nombre', { synchronize: false })`).
  **Criterio de cierre de toda migración**: `npm run migration:generate` contra `faro_dev`
  migrada responde «No changes in database schema» (no se deja el archivo).
- **Claves**: longitud con `errorDeClave()` (mín. 8 caracteres, máx. 72 **bytes**) y hash con
  `hashearClave()` (`@seguridad/utils/clave`, bcrypt costo 12); B4 y B7 reutilizan ambas.
- **Seed del admin de plataforma**: `npm run seed:admin` (idempotente, lee `ADMIN_*` del `.env`).
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
  `architecture.md` §1 en la misma tarea. **Antes de instalarla, comprobar que Jest 29 la carga**:
  el `require` de sus `exports` (y el de sus dependencias) debe dar CommonJS. Un paquete o una
  dependencia solo ESM rompe los unit y los e2e (`@nestjs/jwt` 12 y `otplib`, decisiones 86 y 94).
- **Express 5** (Nest 11, decisión 79): los comodines de ruta llevan nombre (`*splat`, `{*splat}`); el
  `query parser` es `simple`, así que `a[]=1` y `a[b]=1` no se parsean. Las listas en un filtro van
  como parámetro repetido (`?estado=1&estado=2`) y el DTO normaliza un solo valor a arreglo con
  `@Transform` antes de `@IsArray` (ver `test/utils/controlador-express5.ts`).
- **Parches de seguridad** del mismo minor: solo dentro del plan de la tarea que los detecta
  (decisión 74). Al cerrar cada tarea, `npm audit --omit=dev` y se anota el resultado.

## `common/` (B2)
- **Todo dato de un negocio se lee con `NegocioRepository`**
  (`NegocioRepositoryFactory.para(Entidad, manager?)`), nunca con `Repository` a mano ni con un
  `idNegocio` escrito en cada consulta. En su QueryBuilder no hay `orWhere()`: las condiciones OR
  van en `andWhere(new Brackets(...))`. Solo `plataforma/` lee varios negocios (decisión 77).
- **Entidades**: heredan de `BaseNegocioEntity` / `BaseAnulableEntity` (`@common/entities`,
  `id_negocio` NOT NULL). Solo las que pueden ser de plataforma (`persona`, `usuario`,
  `rol_usuario`) heredan de `BaseNegocioOpcionalEntity` (nullable): **TypeORM no deja redeclarar
  una columna heredada** (gana la del padre, decisión 81). Fechas técnicas `timestamptz`
  (decisión 75).
- **`bitacora` es la excepción de `NegocioRepository`** (decisión 84): no hereda de ninguna base.
  Toda lectura y escritura pasa por un único `BitacoraService` (`registrar` en B4, `consultar` en
  B7) que toma `idNegocio` e `idUsuario` del contexto, nunca del DTO ni de la ruta, y falla
  cerrado (403) sin `idNegocio` en `consultar`. Solo `plataforma/` lee la de varios negocios.
  Antes de la sesión (login, verificación 2FA) se usa `registrarAcceso(evento, actor, detalle)`,
  con `actor` de la fila de `usuario` leída en el servidor (decisión 88). Nunca la clave ni el
  token en `detalle` ni en un log (decisión 93). Eventos en `seguridad/constants/eventos-bitacora.ts`.
- **`NegocioRepository` devuelve el 403 como promesa rechazada** (sus lecturas son `async`); solo
  `createQueryBuilder()` lanza al crearse.
- **Solo `save()` audita** (`usuario_registro`, `usuario_modificacion`, `id_negocio`). Con
  `update()`, `insert()` o QueryBuilder sobre esas tablas, la auditoría se escribe a mano.
- **Fechas de negocio con `Reloj`** (`reloj.hoy()`, `ahora()`), nunca `new Date()` ni
  `CURRENT_DATE`. Fechas técnicas y de seguridad con la hora real (decisión 61). En tests,
  `overrideProvider(Reloj).useValue(new RelojFijo('AAAA-MM-DD'))`.
- **Montos, costos y tasas con `Decimal`** (`import { Decimal } from 'decimal.js'`), redondeo con
  `redondearMonto` / `redondearCosto`, columnas `numeric` con `decimalTransformer`. Nunca `number`.
- **Errores**: las reglas de negocio lanzan `HttpException` con mensaje en español; el filtro
  global traduce 23505/23503 → 409, 23514 → 400 y lo demás → 500 sin detalles de la base.
- **Swagger**: el plugin de la CLI documenta los `*.dto.ts` y `*.entity.ts`; se escribe
  `@ApiProperty` solo para `example`, enums o tipos que el plugin no infiere.

## Auth (B4)
- **Guard JWT global** (`seguridad/auth/guards/jwt-auth.guard.ts`, `APP_GUARD` en `AuthModule`):
  toda ruta exige sesión salvo las `@Publico()` (login, salud), donde ni lee el token. Relee en
  cada request usuario, negocio y `version_sesion` (401 si algo no cuadra). Con
  `debe_cambiar_clave`, 403 salvo en rutas `@PermitidoConClaveTemporal()` (solo el cambio de
  clave). Una ruta protegida con Swagger lleva `@ApiBearerAuth()`.
- El usuario de la sesión sale del **contexto** (`RequestContextService`), nunca de un `:id` en la
  ruta ni del body.
- **`version_sesion`** (decisión 87): quien cambie la clave, la restablezca (B7) o active o
  desactive la 2FA (B5) la sube; eso cierra las demás sesiones.
- `seguridad/auth` lee `usuario` con un `Repository` normal (por login o por la PK del token):
  corre antes de que haya negocio en el contexto. Fuera de ahí, `usuario` y `persona` se leen
  con `NegocioRepository`.
- E2E: una ruta de prueba se marca `@Publico()` o `@SoloAutenticado()` y se llama con un token de
  `POST /api/auth/login`; los usuarios se crean con `test/utils/usuarios-de-prueba.ts` (clave
  aleatoria). Varios logins seguidos cuentan para el bloqueo: cada caso usa su propio usuario.

## 2FA (B5)
- Flujo y contrato: `architecture.md` §11 (decisiones 50, 94 a 98). El login responde una unión
  discriminada por `estado` (`OK` | `CONFIGURAR_2FA` | `VERIFICAR_2FA`); la 2FA es obligatoria
  para el admin de plataforma.
- **Token temporal** (`TokenService.firmarTemporal`, 5 min, `proposito: '2fa'`): el guard lo
  acepta solo en rutas `@SoloTokenTemporal2fa()` y deja `request.usuario2fa` (léelo con
  `@Usuario2fa()`), **no** `usuarioActual`: el contexto no tiene sesión. Por eso la 2FA escribe
  con QueryBuilder y `usuario_modificacion` a mano, y la bitácora con `registrarAcceso`.
- Fallos de clave y de código suman en `IntentosService` (`sumarFallo`, `reiniciar`,
  `estaBloqueado`); con 2FA pendiente la clave correcta no reinicia el contador.
- TOTP solo vía `seguridad/utils/totp.ts` (otplib por paquetes sueltos, decisión 94) y siempre con
  la **hora real**: un test con instante fijo pasa `epoch` (segundos), nunca `RelojFijo`.
- `totp_secreto` se cifra con `CifradoTotpService` (AES-256-GCM, AAD por usuario); nunca se
  guarda ni se registra el secreto, la `uri`, un código o un token.
- E2E: `test/utils/totp-de-prueba.ts` genera los códigos con otplib (`codigoTotp`,
  `secretoDeUri`). Un admin de prueba recibe `CONFIGURAR_2FA`: enrólalo por la API (ver
  `test/dos-factores.e2e-spec.ts`).

## Permisos (B6)
- Diseño y contrato: `architecture.md` §7 y §11 (decisiones 99 y 100). Todo vive en
  `seguridad/permiso/`.
- **Denegar por defecto**: toda ruta lleva `@Publico()`, `@SoloAutenticado()` (acciones de la
  propia cuenta) o `@RequierePermiso(MODULOS.X, OPCIONES.Y)`; sin ninguna, `PermisoGuard` responde
  403 y `src/rutas-con-permiso.spec.ts` hace fallar `npm test`. Los códigos salen de `MODULOS` y
  `OPCIONES` (no compila uno que no exista). El permiso se consulta en cada request; no va en el
  JWT.
- **Costos**: una respuesta con costo, margen o valor de inventario lleva
  `@OmitirSinVerCostos(MODULOS.X, ['campo', ...])` con la lista de claves explícita (decisión 100).
- **Un módulo o una opción nueva es una migración propia** que inserta el módulo, sus pares en
  `modulo_opcion_sistema` y llama a `otorgarARolesFijos(queryRunner, 'codigo')`
  (`src/database/utils/`), para que el Dueño de cada negocio y el rol de plataforma lo reciban; se
  suma también a `constants/catalogo.ts` y a `MODULOS`. El e2e «todo rol fijo tiene todos los
  pares de su ámbito» falla si se olvida. No se edita la migración `Permisos`.
- **Roles de un negocio nuevo**: `crearRolesIniciales(manager, idNegocio)` (D2 lo llama dentro de
  la transacción del registro). El rol de plataforma lo repone `asegurarRolPlataforma`.
- Los permisos de un rol solo se tocan tras resolver el rol con `NegocioRepository` (404 si es de
  otro negocio). Un `PUT` de permisos no concede ni quita lo que el rol del editor no tiene
  (anti-escalada); B7 aplica la misma regla al asignar un rol a un usuario.
- E2E: `crearUsuarioDePrueba` asigna rol (`rol: 'DUENO' | 'EMPLEADO'`, por defecto Dueño; el
  rol de plataforma si no hay negocio). `limpiarBase()` **no** vacía las tres tablas de catálogo
  (`TABLAS_DE_CATALOGO`) y repone el rol de plataforma. Para un usuario con permisos exactos,
  ver `conPermisos` en `test/permisos.e2e-spec.ts`.
- Un alias nuevo de `tsconfig.json` se escribe con `./src/...` (sin `baseUrl`, decisión 101).

## Usuarios, bitácora y 2FA del dueño (B7)
- Contrato y reglas: `architecture.md` §11 (decisiones 102 a 105). Usuarios en
  `seguridad/usuario/`, personas en `seguridad/persona/`.
- **Quien actúa sobre otro usuario cubre su rol** (`paresFaltantes`, `usuario/utils/jerarquia.ts`):
  el rol actual del objetivo y el rol que se asigna. Nadie toca su propia fila ni al Dueño, y el
  rol fijo no se asigna. Toda ruta nueva que cambie el rol, la clave o el estado de otro usuario
  pasa por esta regla; `UsuarioService.objetivoGestionable` / `rolAsignable` son el punto único.
- **Restablecer y desbloquear** son `UsuarioClaveService` (operaciones con el actor, `UPDATE`
  explícito con `usuario_modificacion`): D14 las reusa desde plataforma. Un evento de plataforma
  sobre un usuario de un negocio debe quedar en la bitácora **de ese negocio** (hoy `registrar` usa
  el negocio del contexto: D14 agrega la variante que lo recibe).
- Una persona o un usuario se leen con `NegocioRepository`; una referencia de otro negocio
  (`idPersona`, `idRolUsuario`) responde 404. La salida de usuarios es un DTO explícito: nunca la
  clave ni el secreto TOTP. El login repetido responde siempre el mismo mensaje (decisión 105).
- **Bitácora**: `BitacoraService.consultar` toma el negocio del contexto (403 sin él) y es el
  único camino de lectura; paginación común en `common/dto/paginacion.dto.ts`. Un evento nuevo se
  agrega a `EVENTOS_BITACORA` (alimenta `GET /api/bitacora/eventos`).
- **2FA con sesión** (`Cuenta2faService`, `/api/cuenta/2fa`): solo el Dueño; tocar el segundo factor
  pide clave (configurar) o clave y código (desactivar, regenerar); un fallo responde 400 y suma al
  bloqueo. Lo que comparte con el login vive en `SegundoFactorService`.
- E2E: `test/utils/roles-de-prueba.ts` (`crearRolConPermisos`, `crearUsuarioConPermisos`) arma un
  usuario con permisos exactos; las filas de bitácora con fecha fija se insertan directo con horas
  locales (`-04`) para probar `desde`/`hasta`.
