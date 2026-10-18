# Base reutilizada desde SIAP

> Estado: **lista final (tarea A4)**. Fecha: 2026-10-17. Revisado contra el código real de
> `D:\SIAP` (solo lectura). Hallazgos, dependencias y respuestas: `docs/revisiones/A4.md`.
> Decisiones: `docs/decisiones.md` (43 a 51). Arquitectura: `docs/architecture.md`.
> La columna "Tarea" usa la numeración de `docs/tasks.md` tras A5 (decisión 62), corregida en B1.

**Copiar y adaptar, no copiar a ciegas.** Varios archivos dependen de dominios de SIAP que FARO
no tiene (institución, rol operativo, proyecto) o de librerías que FARO no usa (PrimeNG,
notiflix, moment, FontAwesome).

Leyenda:
- **=** portar casi igual;
- **~** portar adaptando (la columna dice qué cambiar);
- **R** reescribir, con SIAP como referencia;
- **✗** no portar.

Rutas relativas a `D:\SIAP\siap-backend\src` (backend) y `D:\SIAP\siap-frontend\src\app`
(frontend), salvo que se indique otra cosa.

## Reglas al portar

1. **`common/` no importa nada de `seguridad/` ni de módulos de dominio.** En SIAP,
   `common.module.ts` importa `AuthModule`, el guard JWT y el interceptor importan de
   `seguridad/auth/services/token.service`, y `anulacion.util.ts` importa `Usuario`. En FARO el
   guard JWT vive en `seguridad/` y el payload del token se tipa en `common/`.
2. **Auditoría y `id_negocio` dependen de `AuditoriaSubscriber`**, que solo actúa con `save()`.
   Las entidades `BaseEntity` se guardan con `save()`. Un `update()`, `insert()` o
   QueryBuilder sobre esas tablas setea a mano `usuario_modificacion` (en SIAP,
   `usuario.service.changeClave` usa `update()` y pierde la auditoría).
3. **`BaseEntity` conserva su nombre** para que el código portado compile igual. Una regla
   `no-restricted-imports` de ESLint prohíbe importar `BaseEntity` desde `typeorm`.
4. **`PartialType` se importa desde `@nestjs/swagger`**, no desde `@nestjs/mapped-types` (en
   SIAP llega transitivo, sin declarar), para que Swagger documente los DTO de actualización.
5. **Zona horaria única**: se conservan `ZONA_HORARIA = 'America/La_Paz'` (`date.utils`), el
   `extra.options: '-c timezone=…'` de la conexión y el `TZ=UTC` de los unit tests
   (`test/jest-global-setup.js`).
6. **Variables de entorno `DB_*`** (no `DATABASE_*`), CORS con `CORS_ORIGIN` y `listen(PORT)`
   (SIAP escucha en la IP de `HOST_FRONTEND`).
7. **Sin notiflix** (decisiones 34 y 46): `Notify` → `MatSnackBar`; `Confirm` →
   `ConfirmDialogComponent` con `confirmar(mensaje): Observable<boolean>`; `Loading` →
   indicadores locales (`mat-progress-bar`, botón deshabilitado mientras guarda), sin overlay
   global.
8. **Sin PrimeNG, moment ni FontAwesome** (decisiones 4 y 34). Antes de copiar un componente se
   buscan imports de `primeng`, `notiflix`, `moment` y `@fortawesome`.
9. **Sin `persona` de SIAP tal cual**: FARO tiene su propia `persona` por negocio
   (decisión 43, `architecture.md` §7). Lo que en SIAP sale de `institucion` (unidad
   organizacional, asignación de personal, rol operativo) no se porta.

## Backend

### `common/`
| Archivo de SIAP | Cat. | Cambio en FARO | Tarea |
|---|---|---|---|
| `entities/base.entity.ts` | ~ | `strict` (campos con `!`); `timestamptz` en las fechas técnicas (decisión 75); regla 3. Hecho en B2, con barrel `entities/index.ts` | B2 |
| `entities/base-anulable.entity.ts` | ~ | Extiende `BaseNegocioEntity` (nueva); `fecha_anulacion` `timestamptz`. Hecho en B2 | B2 |
| `services/request-context.service.ts` | ~ | Suma `idNegocio` y `obtenerIdNegocio()`. Hecho en B2 | B2 |
| `subscribers/auditoria.subscriber.ts` | ~ | Pone `id_negocio` del contexto al insertar y rechaza uno distinto; en update rechaza otro negocio y cambiar el `id_negocio` (`architecture.md` §6, decisión 77); sin `any`. Hecho en B2 | B2 |
| `interceptors/contexto-request.interceptor.ts` | ~ | Tipo de payload propio de `common` (`types/payload-token.ts`); suma `idNegocio`. Hecho en B2 | B2 |
| `guards/jwt-auth.guard.ts` | ~ | Pasa a `seguridad/auth/guards/`; valida en cada request el estado del usuario y del negocio y `debe_cambiar_clave` (decisiones 30 y 48) | B4 |
| `decorators/publico.decorator.ts` | = | — | B2 |
| `common.module.ts` | ~ | Sin `imports: [AuthModule]`; los `APP_GUARD` se registran en `seguridad` (B4). Suma `Reloj`, `NegocioRepositoryFactory` y `APP_FILTER`. Hecho en B2 | B2/B4 |
| `dto/anular.dto.ts`, `incluir-anulados.dto.ts`, `motivo.dto.ts`, `notas.dto.ts` | = | Solo `!` por `strict`. Hecho en B2 | B2 |
| `utils/anulacion.util.ts` (+ `anulacion.util.spec.ts`) | ~ | **`conUsuarioAnulacion()` no se porta en B2** (usa `Usuario`): la escribe D6 contra `persona`/`usuario`, con un solo `IN`; se conserva `AHORA_DEL_SERVIDOR`. Spec sin el bloque de esa función. Hecho en B2 | B2 (D6) |
| `utils/date.utils.ts` | ~ | **Sin `fechaHoy()`** (decisión 76): `fechaDe(instante)` pura + `Reloj.hoy()`; `fechaLegible` y `validateDateRange` iguales. Spec nuevo con el proceso en UTC. Hecho en B2 | B2 |
| `utils/math.utils.ts` | R | `redondearMonto` / `redondearCosto` con `Decimal` y `ROUND_HALF_UP` explícito (§5) + spec; no se porta `calcularCostoParcial`. Hecho en B2 | B2 |
| `utils/decimal.transformer.ts` | nuevo | `numeric` ↔ `Decimal` (§5); acepta los operadores de búsqueda (`MoreThan`, `Between`, `In`). Hecho en B2 | B2 |
| `utils/error-message.ts` | R | `getPgErrorCode` se reutiliza en el filtro global (§10); `handleServiceError` no se porta. Hecho en B2 | B2 |
| `utils/repository.utils.ts` | R | Reemplazado por `NegocioRepository` + `NegocioRepositoryFactory` (§6, decisión 77). Hecho en B2 | B2 |
| — | nuevo | `reloj/` (`Reloj`, `RelojSistema`, `RelojFijo`; decisión 61), `filters/excepciones.filter.ts` (decisión 32), `errors/negocio-incorrecto.error.ts`. Hecho en B2 | B2 |
| `filters/multer-exception.filter.ts` | ✗ | FARO no sube archivos en la preliminar | — |
| `utils/carpeta-archivos.util.ts` (+ spec) | ✗ | Atado a documentos de SIAP | — |

**Tests**: de `common/utils/` solo `anulacion.util` tiene spec en SIAP. B2 escribió los de
`date.utils`, `math.utils`, `decimal.transformer`, `error-message`, `Reloj`, `NegocioRepository`,
`AuditoriaSubscriber`, `RequestContextService` y del filtro de errores, y un e2e de contexto
(`test/contexto.e2e-spec.ts`).

### `seguridad/` y `abc/usuario`, `abc/permiso`
| Archivo de SIAP | Cat. | Cambio en FARO | Tarea |
|---|---|---|---|
| `seguridad/auth/services/token.service.ts` | ~ | Payload `{ idUsuario, idNegocio }`; token temporal de 2FA (P, decisión 50) | B4 (token temporal: B5) |
| `seguridad/auth/services/auth.service.ts` | R | Sin rol operativo; 401 (SIAP: `findOneOrFail` + `catch` → 400); respuesta de `architecture.md` §11; `findMenu` y `findPermiso` filtran `id_estado`; nombre con `nombreCompleto(persona)`; registra en `bitacora` (decisión 51) | B4 |
| `seguridad/auth/controllers/auth.controller.ts`, `dto/login.dto.ts` | ~ | `POST /auth/login` (SIAP: `POST /auth`) | B4 |
| `seguridad/auth/types/response-login.interface.ts` | ✗ | Contrato nuevo (§11) | B4 |
| `seguridad/auth/auth.module.ts` | ~ | `JWT_SECRET` desde `ConfigService` | B4 |
| `abc/usuario/entities/usuario.entity.ts` | ~ | `id_persona` a la `persona` de FARO; `id_negocio`; `debe_cambiar_clave`; `totp_secreto` (cifrado), `totp_activo`; índice único global `lower(usuario)` con `id_estado = 1` (decisiones 43, 48 y 50) | B3 |
| `abc/usuario/services/usuario.service.ts` | ~ | Sin `CLAVE_POR_DEFECTO = '1234'`: clave temporal del dueño (mín. 8) y restablecer clave (decisión 48); `findManyByStatus` usa el filtro (SIAP lo ignora); `changeClave` con `save()`; `findAllDetalle` sin `CONCAT` | B4 (`changeClave`) / B7 |
| `abc/usuario/controllers/`, `dto/` (incl. `change-clave.dto.ts`), `types/`, `usuario.module.ts` | ~ | Sin `InstitucionModule`; `PartialType` desde `@nestjs/swagger` | B4 (`change-clave`) / B7 |
| `abc/permiso/entities/rol-usuario.entity.ts` | ~ | `id_negocio` (null en plataforma); único `(id_negocio, nombre)`; marca de rol fijo (Dueño) (decisión 44) | B6 |
| `abc/permiso/entities/modulo-sistema.entity.ts`, `opcion-modulo-sistema.entity.ts`, `constants/tipo-modulo-codigo.ts` | = | Catálogo global; filas solo por migración (decisión 45) | B6 |
| `abc/permiso/entities/permiso-rol-usuario.entity.ts` | = | — | B6 |
| `abc/permiso/services/permiso-rol-usuario.service.ts`, su controller y DTO | ~ | Rechaza editar el rol Dueño; matriz módulos × opciones; registra en `bitacora` el cambio de permisos | B6 |
| `abc/permiso/services/modulo-sistema.service.ts` (`findAllArbol`) | ~ | Solo lectura | B6 |
| CRUD de módulos, opciones y roles (`*-modulo-sistema.*`, `rol-usuario.*`: controllers, services, DTO) | ✗ / ~ | Módulos y opciones: ✗ (cambian por migración). Roles: ~, el dueño crea roles propios de su negocio | B6 |
| — | nuevo | `@RequierePermiso` y `PermisoGuard` (decisión 38); omitir costos sin `ver_costos` (decisión 49) | B6 |

### Raíz del backend
| Archivo de SIAP (`D:\SIAP\siap-backend\`) | Cat. | Cambio en FARO | Tarea |
|---|---|---|---|
| `src/main.ts` | ~ | Sin `dotenv` ni `setTypeParser`; Swagger en `/api/docs`; prefijo `/api`; `listen(PORT)`; `CORS_ORIGIN`; `trust proxy` solo si `TRUST_PROXY` lo indica (decisión 51); sin `useStaticAssets` | B1 |
| `src/app.module.ts` (solo la config de TypeORM) | ~ | `synchronize: false`, migraciones, `-c timezone=`, `DB_*`; sin `ServeStaticModule` ni `HttpModule` | B1 |
| `test/jest-global-setup.js` | = | — | B1 |
| `.eslintrc.js` | ~ | + `no-restricted-imports` (regla 3) | B1 |
| `.prettierrc`, `.editorconfig`, `.nvmrc`, `nest-cli.json`, `tsconfig.build.json` | = | `nest-cli.json` sin el bloque `assets` (FARO no tiene `src/assets`) | B1 |
| `.gitattributes` | = | En la raíz del monorepo, no en `faro-backend/` | B1 |
| `tsconfig.json`, bloque `jest` de `package.json` | ~ | `strict: true` (decisión 33); aliases de FARO (§3) | B1 |

### Fuera del inventario (referencia, no se porta)
- `abc/ejecucion-proyecto/utils/fifo.util.ts` (+ spec): FIFO calculado al vuelo, sin persistir
  costo, con `number`. Choca con los asientos inmutables (decisiones 18 y 36). Sirven como
  referencia la técnica de cantidades enteras, la regla "la salida resta su costo real y con
  cantidad 0 el valor es 0" (decisión 29) y el test de propiedades con semilla fija. Qué se
  aprovecha lo decide A5 (2).
- `abc/ejecucion-proyecto/utils/orden-fecha-lote.util.ts`: referencia para A5 (1).
- Todo el resto de `abc/`.

## Frontend

### `core/`
| Archivo de SIAP | Cat. | Cambio en FARO | Tarea |
|---|---|---|---|
| `interceptors/token.interceptor.ts` | = | Lee el token de `localStorage` vía `SessionService` | F2 |
| `interceptors/sesion-expirada.interceptor.ts` | ~ | `MatSnackBar`; excluye exactamente `/auth/login` (SIAP: cualquier URL con `'/auth'`); un 401 limpia el almacenamiento | F2 |
| `guards/auth.guard.ts`, `redirect.guard.ts`, `permiso-rol-usuario.guard.ts` | = | + guard que, con `debeCambiarClave`, solo deja entrar a "Cambiar contraseña" | F2 |
| `models/http/api-error.model.ts` | = | — | F2 |
| `models/auth/response-login.ts` | ✗ | Contrato nuevo (§11) | F2 |
| `services/auth/auth.service.ts` | ~ | `POST /auth/login`; paso de 2FA (P) | F2 |
| `services/auth/session.service.ts` | R | Contrato nuevo; `localStorage` y cierre de sesión en todas las pestañas con el evento `storage` (decisión 47); se conservan `tieneOpcionModuloSistema`, `puedeVer`/`puedeCrear`/`puedeEditar`/`puedeEliminar` y el estado del sidebar | F2 |
| `services/auth/seleccion-rol-operativo.service.ts` | ✗ | Decisión 22 | — |
| `services/sistema/msg.service.ts` | ~ | Sin mensajes de dominio de SIAP (Sección, Frente, APU, Plantilla…) | F2 |

### `layout/`, `shared/` y `domains/`
| Archivo de SIAP | Cat. | Cambio en FARO | Tarea |
|---|---|---|---|
| `layout/` (layout, header, navbar, sidebar, sidemenu) | ~ | Logo de FARO (SIAP: `assets/images/logos/escudo-letras-negras.png`); Material Symbols en lugar de FontAwesome (`faUser`); "Cerrar sesión" siempre visible en el header (decisión 47); tema M3 | F4 |
| `layout/boards/` | ✗ | Componente vacío | — |
| `shared/constants/accion.ts` | ~ | Opciones de FARO (decisión 49): `ver`, `crear`, `editar`, `eliminar`, `anular`, `cerrar`, `reabrir`, `ver_costos` | F2 |
| `shared/permiso/` (modelo y lookup de módulo) | = | — | F3 |
| `shared/models/tree-data.model.ts`, `shared/utils/tree-utils.service.ts` | ✗ | Dependen de PrimeNG `TreeTable`; las tablas jerárquicas son `mat-table` planas con sangría por nivel | — |
| `shared/utils/notify.util.ts` (+ spec) | ~ | `MatSnackBar`; `extractErrorMessage` igual | F3 |
| `shared/utils/resource.util.ts` (+ spec) | ~ | El spec mockea `Notify` de notiflix: cambiar el mock | F3 |
| `shared/utils/http-params.util.ts`, `table-filter.util.ts`, `text.util.ts`, `auto-seleccionar.util.ts` (+ spec) | = | — | F3 |
| `shared/pipes/formato-moneda.pipe.ts` | R | Pipe `moneda` (§12): recibe string, signo opcional, sin aritmética | F3 |
| `shared/pipes/formato-fecha.pipe.ts` | ~ | Locale `'es'` (SIAP: `'en-US'`) | F3 |
| `shared/pages/acceso-denegado/` | = | — | F3 |
| `shared/components/btn/`, `combobox/` (con sus 3 specs), `chip-editable/` | = | Sin dependencias externas | F3 |
| `shared/components/notas-dialog/`, `editar-valor-dialog/` | ~ | `Confirm` → `ConfirmDialogComponent` (regla 7) | F3 |
| — | nuevo | `ConfirmDialogComponent` + servicio `confirmar()` (decisión 46) | F3 |
| — | nuevo | Buscador de persona con alta en el mismo formulario (decisión 43), sobre el `combobox` | F6 |
| `shared/components/carga-archivo/`, `mapa-punto/` | ✗ | FARO no sube archivos; `mapa-punto` usa leaflet | — |
| `shared/institucion/`, `shared/proyecto/`, `shared/ciclo-vida/`, `shared/catalogo-base/`, `shared/documento-adjunto/`, `shared/costeo-personal/` | ✗ | Dominios de SIAP | — |
| `domains/login/login.component.ts`, `models/request-status.model.ts` | ~ | Sin notiflix; sin `components/seleccion-rol-operativo/` | F4 |
| `domains/usuario/**` (incl. `cambiar-contrasena`) | ~ | Persona de FARO con buscador (no `@institucion`, sin unidad organizacional); clave temporal; restablecer clave; sin notiflix | F6 (`cambiar-contrasena`: F4) |
| `domains/permiso/components/permiso-rol-usuario/` | R | Matriz módulos × opciones con casillas (`mat-table`); el rol Dueño se muestra de solo lectura (decisiones 44 y 45) | F6 |
| `domains/permiso/components/rol-usuario/` | ~ | Roles del negocio; sin notiflix | F6 |
| `domains/permiso/components/modulo-sistema/`, `opcion-modulo-sistema/` | ✗ | Módulos y opciones cambian por migración (decisión 45) | — |

### Raíz del frontend
| Archivo de SIAP (`D:\SIAP\siap-frontend\`) | Cat. | Cambio en FARO | Tarea |
|---|---|---|---|
| `src/app/app.config.ts` | ~ | Sin `providePrimeNG`; `DateFnsAdapter` (`@angular/material-date-fns-adapter`) con locale `es` en lugar de `MomentDateAdapter`; formatos de fecha `dd/MM/yyyy` | F1 |
| `src/main.ts` | ~ | Sin `Notiflix.*.init`; se mantiene `registerLocaleData(localeEs)` | F1 |
| `src/app/app.routes.ts` | R | Solo login, layout, acceso denegado, cambiar contraseña, usuario y permiso | F4 |
| `src/environments/`, `eslint.config.js`, `prettier.config.js`, `.editorconfig` | = | — | F1 |
| `tsconfig.json` | ~ | Ya es `strict: true`; aliases de FARO (§3) | F1 |
| `src/assets/styles/_variables.scss`, `src/styles.scss` | ✗ | Tema M3 y tokens `--faro-*` propios (§12) | F1 |

## Base de datos
- Las tablas de seguridad (`persona`, `usuario`, `rol_usuario`, `modulo_sistema`,
  `opcion_modulo_sistema`, `permiso_rol_usuario`, `usuario_codigo_respaldo`, `bitacora`) y sus
  seeds (admin de plataforma, módulos, opciones) se crean con **migraciones** en FARO. No se
  copian backups `.sql` de SIAP.
- Opciones de permiso de la seed (decisión 49): `ver`, `crear`, `editar`, `eliminar`, `anular`,
  `cerrar`, `reabrir`, `ver_costos`. La lista de módulos se define en B4, siguiendo spec §4.

## Referencias de CONTROLADOR

`D:\CONTROLADOR` se revisó en el chat de revisión de A4 (solo lectura). Lo que se toma como idea:

- **Autenticación en 2 pasos (TOTP).** Revisada en la rama `dev` de CONTROLADOR
  (`src/auth/services/auth.service.ts`, `controllers/auth.controller.ts`, `dto/mfa-*.dto.ts`,
  `interfaces/login-response.interface.ts`; usa `otplib`, `@nestjs/jwt` y `passport-jwt`).
  **Se toma como referencia de diseño, no se copia**, porque tiene fallas de seguridad graves.
  - **Lo que se adopta:**
    - Login con **estados explícitos**: `SUCCESS`, `PENDING_SYNC` (falta configurar la 2FA) y
      `VERIFY_TOKEN` (falta el código). En FARO: `OK`, `CONFIGURAR_2FA` y `VERIFICAR_2FA`.
    - **Enrolamiento forzado en el login**: si la 2FA es obligatoria y el usuario aún no tiene
      secreto, el login le muestra el código QR (URI `otpauth://` con `keyuri`, emisor
      `APP_NAME` = "FARO") y la activa al confirmar el primer código.
    - **Bloqueo por intentos fallidos** (`login_attempts`, estado `BLOQUEADO`) y mensaje
      genérico "Credenciales inválidas".
    - Registro en la bitácora de la verificación 2FA.
    - El guard JWT revisa el estado del usuario en cada request (FARO ya lo tiene, decisión 30).
  - **Lo que NO se repite (fallas encontradas):**
    1. `POST /auth/mfa/verify` es público y solo pide `idUser` + código: **se salta la
       contraseña**. Con el id de un usuario, basta adivinar el código de 6 dígitos, y no hay
       límite de intentos en esa ruta.
    2. `POST /auth/mfa/activate` es público, recibe `idUser`, `secret` y código del cliente y
       **no verifica que el usuario aún no tenga 2FA**: cualquiera puede poner su propio secreto
       en la cuenta de otro y recibir su JWT (toma de cuenta sin contraseña).
    3. El secreto se guarda en texto plano y viaja ida y vuelta por el cliente.
    4. El bloqueo tras 3 fallos es **permanente** hasta que intervenga un admin: cualquiera que
       conozca nombres de usuario puede bloquear todas las cuentas.
    5. "Cuenta bloqueada" se responde antes de verificar la clave: revela que el usuario existe.
    6. Sin códigos de respaldo ni protección contra reusar el mismo código dentro de su ventana
       de 30 s.
    7. Rol fijo `'Administrador'` en el JWT y variables globales en `globalThis`.
  - **En FARO** (decisiones 50 y 53):
    - Tras la contraseña correcta, la API emite un **token temporal** (JWT de 5 min con
      `proposito: '2fa'`, firmado con `JWT_SECRET`) que el guard solo acepta en
      `POST /api/auth/2fa/configurar` y `POST /api/auth/2fa/verificar`. Ninguna ruta de 2FA
      recibe `idUsuario` del cliente: el usuario sale del token temporal.
    - **El secreto nunca viaja de vuelta**: al configurar, el backend lo genera, lo guarda
      **cifrado** como pendiente (`totp_secreto`, `totp_activo = false`) y solo envía el QR y
      la clave para escribirla a mano. Al confirmar el primer código pasa a
      `totp_activo = true`. Configurar solo se permite si `totp_activo = false`.
    - Fallos de contraseña y de código cuentan juntos en `usuario.intentos_fallidos`.
    - **Bloqueo temporal**, no permanente: 5 fallos seguidos → `bloqueado_hasta = ahora +
      15 min`; el admin o el dueño pueden desbloquear antes. El mensaje es siempre
      "Credenciales inválidas" y no revela si la cuenta existe o está bloqueada (el motivo va a
      la bitácora).
    - **Antirreúso**: se guarda `totp_ultimo_paso` y se rechaza un código de un paso ya usado.
      Tolerancia de ±1 paso (30 s) por desfase de reloj.
    - **Códigos de respaldo**: 10, de un solo uso, mostrados una vez al activar y guardados con
      hash (`usuario_codigo_respaldo`).
    - Paquetes: `otplib` (CONTROLADOR usa la 13.x; se fija la versión exacta al instalar) y
      `qrcode` para generar la imagen en el backend, o la URI para que el frontend la dibuje.
- **Bitácora de acciones** (`logs` de CONTROLADOR: usuario, IP, acción, URL, método, user
  agent). Se adopta en la **preliminar** como `bitacora` por negocio (decisión 51), para eventos
  de seguridad y de negocio sensibles: login correcto y fallido, cambio y restablecimiento de
  clave, cambio de permisos, anulaciones, cierre y reapertura de mes, cambio de régimen. Es de
  solo inserción. La obtención de IP de `logger-action.decorator.ts` (`x-forwarded-for`,
  `x-real-ip`, …) sirve, pero esas cabeceras solo se leen si la app corre detrás de un proxy
  confiable (`trust proxy` configurado); si no, se usa `request.ip`, porque el cliente puede
  falsificarlas.
- **Permisos como matriz de booleanos** (`permissions`: `can_create`, `can_read`, `can_update`,
  `can_delete`, `can_restore` por rol × módulo). Confirma la pantalla en matriz (decisión 45).
  FARO mantiene el catálogo de opciones de SIAP (decisión 49) porque necesita opciones propias
  (`anular`, `cerrar`, `ver_costos`).
- **Papelera con restauración** (`deleted_at`, `findAllTrashed`, `restore`). FARO ya tiene baja
  lógica (`id_estado`) y anulación. "Reactivar" un catálogo dado de baja queda como mejora, sin
  pantalla de papelera en la preliminar.
- **`autocomplete-object`** (frontend): **no se usa**. El buscador de persona (decisión 43) y
  toda búsqueda en listas se hacen con el `combobox` de SIAP.
