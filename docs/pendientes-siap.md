# Pendientes de SIAP encontrados desde FARO

Errores y riesgos de `D:\SIAP` detectados al analizarlo como base de FARO (tareas A3, A4, A5 y
B1). **No se corrigen desde FARO** (SIAP es solo lectura en las sesiones de FARO): cada punto se
resuelve en **su propia sesión de SIAP**, con el flujo de trabajo de ese proyecto.

Cómo usar esta lista:
- Al abrir una sesión de SIAP, copia el punto a su archivo de tareas y marca aquí "→ SIAP" con
  la fecha.
- Un hallazgo nuevo de SIAP durante una tarea de FARO se agrega aquí, con su origen.
- Origen = tarea de FARO donde se encontró (ver `docs/revisiones/<ID>.md`).

## Prioridad alta (seguridad o integridad de datos)

| # | Problema | Dónde | Riesgo | Corrección sugerida | Origen | Estado |
|---|---|---|---|---|---|---|
| S1 | `typeorm` 0.3.20 con inyección SQL vía `repository.save` / `update` (GHSA-q2pj-6v73-8rgj), inyección en `migration:generate` y `uuid` vulnerable | `siap-backend/package.json` | Inyección SQL en operaciones de uso diario | Subir a **0.3.31** (parche del mismo minor, mismo cambio que FARO en B2) y correr todos los tests | B1 | Pendiente |
| S2 | Permisos validados **solo en el frontend**; el backend solo verifica el JWT | `core/guards/permiso-rol-usuario.guard.ts` (front); backend sin guard de permisos | Cualquier usuario autenticado puede llamar cualquier endpoint con Postman o curl | Guard de permisos en el backend por módulo y opción (como `@RequierePermiso` de FARO, decisión 38) | A3 | Pendiente |
| S3 | Usuarios creados con clave fija `CLAVE_POR_DEFECTO = '1234'` | `abc/usuario/services/usuario.service.ts` | Cuentas nuevas con clave conocida | Clave temporal definida por quien crea el usuario + cambio obligatorio en el primer ingreso (FARO, decisión 48) | A4 | Pendiente |
| S4 | `synchronize: true` y sin migraciones | `src/app.module.ts` | En producción, un cambio de entidad altera o borra columnas sin control | `synchronize: false` + migraciones (generar la migración inicial desde la base actual) | A3 | Pendiente |
| S5 | `types.setTypeParser(1700, parseFloat)`: todo `numeric` pasa a `number` de punto flotante; `math.utils` solo con `toFixed(2)` | `src/main.ts`, `common/utils/math.utils.ts` | Errores de redondeo en montos y costos (costeo, APU, FIFO) | `decimal.js` con transformer de TypeORM (como FARO, decisión 28), empezando por los cálculos de dinero | A3 | Pendiente |
| S6 | 17 vulnerabilidades en dependencias de producción (`npm audit --omit=dev`): `express`, `path-to-regexp`, `body-parser`, `qs`, `multer`, `lodash`, `js-yaml`, `file-type` | `siap-backend` | DoS, prototype pollution | Aplicar parches del mismo minor; el resto pide Nest 11 o 12: evaluarlo como migración aparte | B1 | Pendiente |

## Prioridad media (errores de comportamiento)

| # | Problema | Dónde | Efecto | Corrección sugerida | Origen | Estado |
|---|---|---|---|---|---|---|
| M1 | El login responde **400 ante cualquier error**, incluso con credenciales malas: `findOneOrFail` lanza antes del `if (!result)` y el `catch` lo convierte todo en `BadRequestException` | `seguridad/auth/services/auth.service.ts` | El frontend no distingue "clave mala" de "error del servidor"; semántica HTTP incorrecta | 401 con credenciales malas; dejar pasar las `HttpException` | A3, A4 | Pendiente |
| M2 | `findMenu` y `findPermiso` no filtran `id_estado` de `modulo_sistema` ni de `permiso_rol_usuario` | `seguridad/auth/services/auth.service.ts` | Un módulo o permiso eliminado sigue apareciendo en el menú | Filtrar `id_estado = 1` en ambas consultas | A4 | Pendiente |
| M3 | `AuditoriaSubscriber` solo cubre `save()`: con `update()`, `insert()` o QueryBuilder la auditoría se pierde | `common/subscribers/auditoria.subscriber.ts` | `usuario_modificacion` vacío en esos casos | Usar `save()` en entidades auditadas o setear la auditoría a mano en `update()` / QueryBuilder | A4 | Pendiente |
| M4 | `changeClave` usa `repository.update()`, que no dispara el subscriber | `abc/usuario/services/usuario.service.ts` | El cambio de clave queda sin `usuario_modificacion` | Cargar la entidad y usar `save()` | A4 | Pendiente |
| M5 | `findManyByStatus` recibe `filtro` y lo ignora | `abc/usuario/services/usuario.service.ts` | El filtro de la pantalla de usuarios no filtra | Aplicar el filtro en la consulta | A4 | Pendiente |
| M6 | `handleServiceError()` convierte todo lo que no es `HttpException` en 400 (salvo 23505 → 409) | `common/utils/error-message.ts` | Errores del servidor reportados como errores del usuario | Filtro global por tipo de error (FK → 409, CHECK → 400, resto → 500), como FARO (decisión 32) | A3 | Pendiente |
| M7 | Pipe de fecha con locale `'en-US'`: los nombres de mes salen en inglés | `siap-frontend/.../shared/pipes/formato-fecha.pipe.ts` | Fechas en inglés en una interfaz en español | Locale `'es'` | A4 | Pendiente |
| M8 | `rol_usuario.nombre` con índice único global | entidad `rol_usuario` | No escala si SIAP llega a tener roles por institución | Revisar solo si SIAP necesita roles por institución | A4 | Pendiente |

## Prioridad baja (mantenimiento)

| # | Problema | Dónde | Corrección sugerida | Origen | Estado |
|---|---|---|---|---|---|
| L1 | `strictNullChecks: false`, `noImplicitAny: false` en el backend | `siap-backend/tsconfig.json` | Activar `strict` de a poco, por módulo | A3 | Pendiente |
| L2 | `common/` depende de dominios: `AuthModule`, `TokenService` y `Usuario` (`anulacion.util.ts`) | `common/common.module.ts`, `common/guards`, `common/utils/anulacion.util.ts` | Mover el guard a `seguridad/` y quitar la dependencia de `Usuario` en `common/` | A4 | Pendiente |
| L3 | Dependencias usadas sin declarar: `dotenv`, `@nestjs/mapped-types` (llegan transitivas) | `siap-backend/package.json` | Declararlas, o usar `PartialType` de `@nestjs/swagger` | A3, A4 | Pendiente |
| L4 | `ts-node-dev` 2.0.0 sin mantenimiento desde 2022 | `start:dev` | `nest start --watch` (como FARO, decisión 65) | B1 | Pendiente |
| L5 | Swagger comentado en `main.ts` | `src/main.ts` | Habilitarlo en desarrollo (como FARO, decisión 70) | A3 | Pendiente |
| L6 | `app.listen(port, hostFrontend)` escucha en la IP del *host del frontend* | `src/main.ts` | `listen(PORT)` y CORS con una variable propia | A4 | Pendiente |
| L7 | Respuesta de login con unos 15 campos marcados `// No uso` y ~10 claves de `sessionStorage` "No se usan" | `response-login.interface.ts`, `session.service.ts` | Limpiar el contrato | A4 | Pendiente |
| L8 | Librerías duplicadas en el frontend: `moment` y `date-fns`; PrimeNG y Material; `notiflix` | `siap-frontend/package.json` | Elegir una por necesidad | A3, A4 | Pendiente |
| L9 | Tailwind no está configurado (solo llega como dependencia de `@angular/build`) aunque hay clases tipo Tailwind en 3 componentes | `siap-frontend` | Configurarlo o quitar esas clases | A3 | Pendiente |
| L10 | Sin configuración de tests e2e en el backend | `siap-backend/test/` | `jest-e2e.json` + base de prueba (como FARO B1) | B1 | Pendiente |
| L11 | `calcularFifo` y `construirKardex` sin test directo (solo `disponibleAlDia` tiene spec) y cálculos con `number` / `toFixed` | `abc/ejecucion-proyecto/utils/fifo.util.ts` | Tests directos; luego pasar a `decimal.js` (S5) | A4, A5 | Pendiente |

## CONTROLADOR (otro proyecto, mismo criterio)

Revisado en la rama `dev` durante A4. Mismo tratamiento: corregir en sesiones de CONTROLADOR.

| # | Problema | Dónde | Riesgo | Corrección sugerida | Estado |
|---|---|---|---|---|---|
| CI1 | `POST /auth/mfa/verify` es público y solo pide `idUser` + código: se salta la contraseña y no limita intentos | `src/auth/controllers/auth.controller.ts`, `services/auth.service.ts` | Entrar sin contraseña adivinando el código de 6 dígitos | Token temporal emitido tras la contraseña; el usuario sale del token, no del body (como FARO, decisión 50) | Pendiente |
| CI2 | `POST /auth/mfa/activate` es público, recibe `idUser` y `secret` del cliente y no verifica que el usuario aún no tenga 2FA | mismos archivos | Tomar la cuenta de otro usuario sin su contraseña | Igual que CI1, y el secreto lo genera y guarda el backend; activar solo si no hay 2FA activa | Pendiente |
| CI3 | Secreto TOTP en texto plano | `users.two_factor_secret` | Si se filtra la base, se pueden generar los códigos | Cifrar con una clave de `.env` | Pendiente |
| CI4 | Bloqueo permanente tras 3 fallos y mensaje "Cuenta bloqueada" antes de verificar la clave | `auth.service.ts` | Cualquiera bloquea todas las cuentas; revela qué usuarios existen | Bloqueo temporal y mensaje genérico (FARO, decisión 53) | Pendiente |
| CI5 | Sin códigos de respaldo ni antirreúso del código TOTP; rol fijo `'Administrador'` en el JWT; variables globales en `globalThis` | `auth.service.ts`, `common/constants/global-vars.ts` | — | Ver `base-desde-siap.md`, "Referencias de CONTROLADOR" | Pendiente |
