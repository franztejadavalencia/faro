# Tareas

Formato: `- [ ] ID · descripción · criterio de "listo"`. Una tarea = una sesión = un commit.
Niveles de `spec.md`: P = versión preliminar, P+ = deseable en la preliminar, C = versión completa.

## Fase 0: Análisis (Opus, flujo de revisión, sin código)
- [x] A1 · Escribir `docs/spec.md` (qué es FARO, usuarios, módulos) · aprobado por mí
- [x] A2 · Cerrar decisiones 3, 4 y 5 de `docs/decisiones.md` · tabla actualizada
- [x] A3 · Escribir `docs/architecture.md` (versiones, carpetas, convenciones de naming,
        manejo de errores, auth, **módulo contable**: entidades `cuenta`, `asiento`,
        `asiento_detalle` con `producto_id` auxiliar, servicio que genera el asiento dentro
        de la misma transacción que el documento, historial de régimen) · aprobado por mí
- [x] A4 · Revisar `docs/base-desde-siap.md` leyendo el código real de SIAP y corregir el
        inventario (dependencias ocultas) · lista final
- [x] A5 · Desglosar Fase 1 y Fase 2 en tareas pequeñas en este archivo. Resolver antes, en
        `docs/revisiones/A5.md`:
        (1) orden de fechas del inventario: documentos que mueven stock con fecha no anterior
        al último movimiento de la sucursal (como `validarOrdenFechaLote` de SIAP para lotes)
        y fecha del movimiento y del asiento de una anulación (resuelto por producto y
        sucursal, decisiones 54 y 55);
        (2) costo persistido al registrar (lo exige el asiento inmutable) frente al cálculo
        FIFO al vuelo de SIAP (`ejecucion-proyecto/utils/fifo.util.ts`): qué se porta;
        (3) datos para la defensa: `fecha_inicio` del negocio en el pasado, seed de
        demostración que registra meses pasados en orden por los servicios reales y cierra
        cada mes, y reloj inyectable para los tests · cerrada 2026-10-17 (decisiones 54 a 63)
- [x] A6 · Aprobar el mockup de dashboard y POS (identidad visual, decisión 23) · aprobado
        2026-10-17 (canvas "FARO · Dashboard y POS"); paleta y tipografía fijadas en A3

Desglose de Fase 1 y Fase 2 hecho en A5 (`docs/revisiones/A5.md`, decisiones 54 a 63).
Criterio común a toda tarea de Fase 1 y 2 (no se repite en cada línea): tests y lint en verde,
Swagger al día y paso 4 del flujo de revisión. "(Opus)" al final de la descripción = se hace
con Opus (decisión 63); el resto, con Sonnet.

## Fase 1: Esqueleto (Sonnet; "(Opus)" donde se indica)
Backend (B) y frontend (F). Pueden avanzar en paralelo cuando haya contrato.

- [x] B1 · Crear `faro-backend`: Nest CLI, `ConfigModule` (`.env.*`), TypeORM con
        `synchronize: false` y CLI de migraciones, `-c timezone=`, Swagger en `/api/docs`,
        prefijo `/api`, CORS, ESLint (+ `no-restricted-imports` de `BaseEntity`), Prettier,
        `.npmrc save-exact`, `.env.example` (incluye `TOTP_CLAVE_CIFRADO`, `TRUST_PROXY`,
        `CORS_ORIGIN`), Jest unit + e2e contra `faro_test` con `TRUNCATE` entre suites ·
        `start:dev` levanta; `/api/docs` responde; `migration:run` corre en vacío; un e2e de
        humo pasa contra `faro_test` · cerrada 2026-10-17 (decisiones 64 a 73)
- [x] B2 · Portar `common/` (`base-desde-siap.md`): entidades base + `BaseNegocioEntity`,
        `RequestContextService` con `idNegocio`, `AuditoriaSubscriber`, `@Publico`, DTOs,
        `anulacion.util`, `date.utils`, `Reloj`/`RelojFijo` (decisión 61), `math.utils` con
        `Decimal`, `decimal.transformer`, `NegocioRepository`, filtro global de errores · specs
        de utils, transformer, `Reloj`, `NegocioRepository` y filtro (23505→409, 23514→400,
        resto→500) en verde · cerrada 2026-10-17 (decisiones 74 a 78; subió `typeorm` a
        0.3.31, decisión 74)
- [x] B2b · Subir a Nest 11 (decisión 79): `@nestjs/common`, `core`, `platform-express` y
        `testing` 11.2.x; `@nestjs/config` 4, `@nestjs/swagger` 11, `@nestjs/typeorm` 11,
        `@nestjs/cli` y `schematics` 11; `@types/express` 5. Revisar Express 5 (comodines de
        ruta `*` → `*splat`, `path-to-regexp` 8, `query parser`) y el orden de lectura de
        variables en `config` 4; versiones exactas y anotadas en `architecture.md` §1; S6 de
        `pendientes-siap.md` con los números nuevos · `lint`, `test`, `build`, `migration:run`
        (`:test`) y `test:e2e` en verde; `start:dev` levanta, `/api/salud` y `/api/docs`
        responden; `npm audit --omit=dev` con 2 o menos (solo `js-yaml` de `@nestjs/swagger`)
- [x] B3 · `negocio` mínimo (id, nombre, estado) + `persona` + `usuario` (con las columnas
        `totp_*` y `usuario_codigo_respaldo` de la decisión 50) + `bitacora` (con trigger de solo
        inserción) + migraciones + seed del admin de plataforma (`npm run seed:admin`, clave
        desde `.env`) + bases `BaseConNegocioEntity` / `BaseNegocioOpcionalEntity` en `common/`
        (decisión 81) · migraciones suben y bajan; e2e: el trigger rechaza UPDATE/DELETE en
        `bitacora`; el índice `lower(usuario)` rechaza un duplicado global · cerrada 2026-10-17
        (decisiones 80 a 85)
- [x] B4 · Auth: `POST /api/auth/login` (respuesta de `architecture.md` §11 con `estado`), JWT,
        `JwtAuthGuard` en `seguridad/` (estado de usuario y negocio, `debe_cambiar_clave` →
        403), cambio de clave, bloqueo temporal (decisión 53), bitácora de login (Opus) · e2e: login
        OK, 401 con clave mala, bloqueo al 5.º fallo y desbloqueo pasados los 15 min (el e2e
        escribe `bloqueado_hasta` en el pasado: es seguridad, usa la hora real), 403 con
        `debe_cambiar_clave`, usuario desactivado y negocio suspendido → 401. Incluye además (de la
        revisión de B3): (1) los métodos de `NegocioRepository` devuelven el 403 sin `idNegocio` como
        **promesa rechazada**, no como excepción síncrona (unit: `find()` sin contexto rechaza);
        (2) `ADMIN_CLAVE` vacía en `.env.example` (un valor de ejemplo copiado a un `.env` real
        sería una clave conocida); (3) en `architecture.md` §2, pendiente del despliegue: hoy
        `seed:admin` fija `NODE_ENV=development`, usa `ts-node` y el glob `src/**/*.entity.ts`, así
        que no corre en producción ni prueba el `debe_cambiar_clave = true` (decisión 82) · cerrada
        2026-10-18 (decisiones 86 a 93; `@nestjs/jwt` 11.0.2, `version_sesion`)
- [x] B5 · 2FA TOTP (decisión 50): `/auth/2fa/configurar` y `/verificar` con token temporal,
        secreto cifrado, URI `otpauth://` y QR (PNG en data URL desde el backend), códigos de
        respaldo con hash, antirreúso `totp_ultimo_paso`, obligatoria para el admin; instalar y
        anotar `otplib` y `qrcode` (Opus) · e2e del flujo completo generando códigos con `otplib`;
        reúso de un paso rechazado; un token temporal no sirve en otras rutas; un código de
        respaldo sirve una sola vez · cerrada 2026-10-18 (decisiones 94 a 98; `@otplib/*` 13.5.0
        por separado, `@scure/base` 1.2.6, `qrcode` 1.5.4)
- [ ] B6 · Permisos: `modulo_sistema`/`opcion_modulo_sistema` por migración (opciones de la
        decisión 49; módulos de spec §4), `rol_usuario` por negocio con Dueño fijo (hereda de
        `BaseNegocioOpcionalEntity`) y el rol de plataforma, `usuario.id_rol_usuario` (asigna el
        rol al admin y recién entonces `NOT NULL` + FK, decisión 85), `permiso_rol_usuario`, menú
        por rol, `@RequierePermiso` + `PermisoGuard`, utilidad para
        omitir costos sin `ver_costos` · e2e: menú por rol; 403 sin permiso; no se puede editar
        el rol Dueño; una respuesta de prueba omite el costo sin `ver_costos`
- [ ] B7 · Usuarios del negocio: CRUD de empleados sobre `persona` (buscar o crear), clave
        temporal, restablecer clave y desbloquear (dueño → empleados; admin → dueño), bitácora;
        **consulta de la bitácora del negocio** para el dueño (filtro por usuario, evento y
        fecha); **2FA opcional del dueño** (decisión 97), con sesión: activar (configurar +
        primer código), desactivar con clave + código y regenerar códigos de respaldo; activar y
        desactivar suben `version_sesion` · e2e: alta con persona nueva y existente; restablecer
        deja `debe_cambiar_clave`; la consulta de bitácora filtra y solo muestra eventos del
        negocio; **aislamiento A/B** (B no ve ni referencia usuarios, personas ni bitácora de A);
        el dueño activa la 2FA y el próximo login pide `VERIFICAR_2FA`; desactivar sin el código
        correcto se rechaza; el admin no puede desactivar la suya
- [ ] F1 · Crear `faro-frontend`: Angular CLI, Material con tema M3 de FARO, tokens `--faro-*`,
        Tailwind 4 sin preflight, Manrope, `DateFnsAdapter` `es`, ESLint, Prettier,
        `.npmrc save-exact` · `npm start` levanta una página con el tema; build y lint sin
        errores
- [ ] F2 · Portar `core/`: interceptors (token, sesión expirada), guards (auth, redirect,
        permiso, `debeCambiarClave`), `SessionService` reescrito (`localStorage`, evento
        `storage`), `AuthService` (login con `estado`), `api-error`, `msg.service`, `accion.ts`
        de FARO · build sin errores; specs de `SessionService` y guards en verde
- [ ] F3 · Portar `shared/`: `combobox`, `btn`, `chip-editable`, pipes `moneda` (reescrito) y
        `formatoFecha`, utils, `notify` con `MatSnackBar`, `ConfirmDialogComponent`,
        `notas-dialog`, `editar-valor-dialog`, `acceso-denegado` · specs portados (combobox ×3,
        notify, resource, auto-seleccionar) y nuevos (`moneda`, `confirmar`) en verde
- [ ] F4 · Layout (sidebar con menú, header con "Cerrar sesión", logo FARO) + login + cambiar
        contraseña (forzado) + acceso denegado, con la identidad del mockup · login real contra
        B4; con `debeCambiarClave` solo deja entrar a cambiar contraseña; cerrar sesión en una
        pestaña cierra las demás
- [ ] F5 · Pantallas 2FA: configurar (QR + primer código + códigos de respaldo una sola vez) y
        verificar (código o respaldo) dentro del login · flujo completo contra B5 con una app
        TOTP real
- [ ] F6 · Pantallas de usuarios (buscador de persona con alta en el mismo formulario, clave
        temporal, restablecer, desbloquear), de permisos (matriz `mat-table`, Dueño de solo
        lectura, roles propios), **consulta de la bitácora del negocio** (filtros por
        usuario, evento y fecha) y **2FA del dueño** (activar con QR y códigos, desactivar,
        regenerar códigos; decisión 97) · CRUD funcional contra B6 y B7; bitácora filtrable
        contra B7; 2FA del dueño contra B7

## Fase 2: Dominio de FARO (Sonnet; "(Opus)" donde se indica)
Backend `D` (dominio) y frontend `V` (vistas) (decisión 62). Cada V va después de su D.

- [ ] D1 · Plataforma: `negocio` completo (`fecha_inicio` fija, decisión 59; valuación fija;
        prorrateo), `sucursal` principal, `regimen_tributario` (seed), `negocio_regimen`,
        `periodo` a demanda con reglas de fecha (decisiones 39 y 59, con `Reloj`),
        `correlativo` · unit de validación de fechas con `RelojFijo`; e2e: un documento de
        prueba crea el periodo; rechazo en mes cerrado, futuro o antes de `fecha_inicio`
- [ ] D2 · Plan de cuentas semilla (spec §5.8) + `categoria_gasto` con subcuenta `5.2.1.NN` +
        `POST /api/registro` en una transacción (con `fecha_inicio`) + cambio de régimen (día 1
        de mes abierto, bitácora) · e2e: el registro crea negocio, sucursal, régimen, plan,
        categorías, roles, persona, usuario, correlativos y primer periodo (mes de
        `fecha_inicio`); si algo falla no queda nada
- [ ] D3 · Contabilidad núcleo: `cuenta`, `asiento`, `asiento_detalle`, CHECKs y trigger de
        inmutabilidad, constructores puros (spec §5.9), `AsientoService.registrar` y `revertir`
        (fecha de la decisión 55) (Opus) · unit: cada fila de spec §5.9 + casos con centavos;
        e2e: el trigger rechaza UPDATE/DELETE; un asiento descuadrado → 500 y no queda nada
- [ ] D4 · Catálogo backend: `linea`, `producto`, `proveedor` sobre `persona`, con
        `ver_costos` aplicado · e2e de **aislamiento A/B** (decisión 30): B no lista, no obtiene
        ni referencia productos ni proveedores de A
- [ ] D5 · Inventario núcleo: `existencia` (con `fecha_ultimo_movimiento`), `lote`,
        `kardex_movimiento`, `valuacion.ts` puro PPP/PEPS (decisión 58), regla de orden por
        producto y sucursal (decisión 54) (Opus) · unit: secuencia que termina en stock 0 y
        valor 0,00 (PPP y PEPS) + test de propiedades con semilla; la regla de orden rechaza
        una fecha anterior al último movimiento del producto
- [ ] D6 · Inventario inicial y ajustes (`ajuste_inventario`) con kardex y asiento; anulación
        (decisiones 55 y 56); kardex por producto y stock valorado con aviso de mínimo; incluye
        `conUsuarioAnulacion` contra `persona`/`usuario`, con un solo `IN` (no se portó en B2)
        (Opus) ·
        e2e: inventario inicial → asiento Inventario/Capital con fecha `fecha_inicio`; merma y
        sobrante; anulación con asiento inverso; kardex con saldos correctos
- [ ] D7 · Compras con kardex y asiento (con y sin factura, por régimen, medio de pago),
        anulación solo sin salidas posteriores (decisión 56) (Opus) · e2e: compra General con
        factura (87/13), Simplificado (100); anulación OK y anulación rechazada tras una venta
- [ ] D8 · Ventas: venta del POS y venta manual resumida, costo PPP/PEPS, "no sin stock",
        comprobante interno, anulación (decisión 55), listado por día, mes y empleado (Opus) ·
        e2e: venta General (asientos de venta y de costo), Simplificado; venta sin stock
        rechazada; anulación repone stock y lotes exactos; anulación rechazada si su fecha
        caería en otro mes
- [ ] D9 · Gastos con asiento (con y sin factura) y "copiar recurrentes del mes anterior" ·
        e2e: gasto General con factura (87/13) y Simplificado; copia de recurrentes
- [ ] D10 · Libro diario del mes (orden `(fecha, numero)`), libro mayor por cuenta con filtro
        por producto, `cuadre.service` (spec §5.10) · e2e: tras compras, ventas, gastos y
        ajustes de prueba, las tres igualdades de §5.10 se cumplen
- [ ] D11 · Cierre y reapertura de mes: orden, cuadre obligatorio, foto
        `resultado_mensual_producto`, prorrateo (spec §5.4), bloqueo exclusivo del periodo,
        bitácora (Opus) · unit del prorrateo (3 criterios, mes sin ventas); e2e: cierre OK,
        cierre rechazado sin el anterior cerrado, registro rechazado en mes cerrado, reapertura
        solo del último y borrado de la foto
- [ ] D12 · Análisis: estado de resultados por producto y línea (cerrado y vista preliminar del
        mes en curso), ranking · e2e: Σ UN_i = resultado contable del mes; sin `ver_costos` no
        hay márgenes
- [ ] D13 · Dashboard (backend): evolución mensual de ventas, MC y utilidad, mes contra mes,
        marca del cambio de régimen · e2e con 3 meses cerrados
- [ ] D14 · Admin de plataforma: listar negocios, activar y suspender, restablecer clave y
        desbloquear al dueño, **restablecer la 2FA del dueño** (decisión 97: `totp_activo =
        false`, sin secreto ni códigos, `version_sesion + 1`, bitácora), **consulta de la
        bitácora de plataforma**, sin acceso a datos comerciales · e2e: el admin no entra a rutas
        de negocio; un negocio suspendido no entra; la bitácora de plataforma no expone datos
        comerciales; tras restablecer la 2FA el dueño entra con `OK` y sus sesiones previas dan 401
- [ ] D15 · Seed de demostración (decisión 60): `npm run seed:demo`, 7 meses por los servicios
        reales con `RelojFijo`, cierre de cada mes, historias del mockup de A6, dueño sin 2FA,
        admin sin 2FA configurada, claves desde `.env.development` · `npm run seed:demo` sobre
        `faro_dev` vacío termina con 6 meses cerrados y el cuadre OK en todos; se niega si el
        negocio demo ya existe o fuera de `development`
- [ ] D16 · Guion de la defensa `docs/defensa.md` (solo documentación): recorrido de la demo
        (login con enrolamiento 2FA del admin, dashboard, la leche que pierde, POS en vivo,
        anulación, cierre con cuadre) para ensayarlo · recorrido ensayado completo sobre los
        datos de D15
- [ ] V1 · Registro autoservicio (con `fecha_inicio`) + configuración del negocio (régimen con
        historial, prorrateo, categorías de gasto) · flujo contra D1 y D2
- [ ] V2 · Catálogo: líneas, productos, proveedores (buscador de persona) · CRUD contra D4
- [ ] V3 · Inventario: carga de inventario inicial, ajustes, kardex, stock valorado con aviso de
        mínimo · contra D5 y D6
- [ ] V4 · Compras: registro y anulación · contra D7
- [ ] V5 · POS: buscar producto, carrito, cobro, comprobante imprimible (diseño del mockup de
        A6) · venta real contra D8 en menos de 4 interacciones por ítem
- [ ] V6 · Ventas manuales resumidas y listado de ventas; anulación · contra D8
- [ ] V7 · Gastos y copia de recurrentes · contra D9
- [ ] V8 · Contabilidad: plan de cuentas (lectura), diario, mayor con filtro por producto,
        vista del cuadre · contra D10
- [ ] V9 · Cierre y reapertura de mes · contra D11
- [ ] V10 · Estado de resultados (cerrado y preliminar) y ranking · contra D12
- [ ] V11 · Dashboard con chart.js (decisión 41), con la identidad del mockup · contra D13 con
        los datos de D15
- [ ] V12 · Admin de plataforma: negocios, suspender, restablecer y desbloquear, **restablecer la
        2FA del dueño** (con confirmación), **consulta de la bitácora de plataforma** · contra D14

**Orden sugerido**: B1, B2, B2b, B3–B7 y F1–F6 en paralelo cuando haya contrato → D1, D2, V1 → D3 → D4, V2
→ D5, D6, V3 → D7, V4 → D8, V5, V6 → D9, V7 → D10, V8 → D11, V9 → D12, V10 → D13, V11 → D14,
V12 → D15 → D16.

## Fase 3: Deseables de la preliminar (P+)
Una línea por grupo, en el orden de spec §6. Se desglosan en tareas (con su ID) al terminar la
Fase 2.

- Punto de equilibrio y alertas (spec §5.6)
- Recomendaciones por reglas (spec §5.6)
- Proyección de ventas (spec §5.7)
- Balance de comprobación
- Sucursales: UI, inventario por sucursal y traspasos
- Planes y pago por QR
- Exportación de reportes a Excel/PDF
