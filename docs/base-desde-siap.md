# Base reutilizada desde SIAP

Inventario de lo que se porta de `D:\SIAP`. **Copiar y adaptar, no copiar a ciegas**: varios
archivos dependen de dominios de SIAP (institución, rol operativo, proyecto) que FARO no tiene.

## Backend (`D:\SIAP\siap-backend\src`)

### Se porta tal cual o casi
- `common/entities/base.entity.ts`, `base-anulable.entity.ts`: campos de auditoría y estado.
- `common/subscribers/auditoria.subscriber.ts` + `common/services/request-context.service.ts`
  + `common/interceptors/contexto-request.interceptor.ts`: usuario actual en la auditoría.
- `common/guards/jwt-auth.guard.ts` + `common/decorators/publico.decorator.ts`.
- `common/dto/` (`anular`, `incluir-anulados`, `motivo`, `notas`).
- `common/utils/`: `date.utils`, `math.utils`, `error-message`, `repository.utils`,
  `anulacion.util` (+ sus `.spec.ts`).
- `common/filters/multer-exception.filter.ts` (solo si FARO sube archivos).
- `main.ts` (bootstrap, CORS, Swagger, ValidationPipe), `.eslintrc.js`, `.prettierrc`,
  `.editorconfig`, `.nvmrc`, `tsconfig*.json`, `nest-cli.json`.

### Se porta adaptando
- `seguridad/auth/` (controller, `auth.service`, `token.service`, `login.dto`,
  `response-login.interface`). **Revisar**: el login de SIAP incluye selección de rol
  operativo (dominio `institucion`). Decidir si FARO lo necesita.
- `abc/usuario/` (entity, service, controller, DTOs, `change-clave.dto`). Quitar relaciones
  con `persona`/`institucion` si FARO no las usa.
- `abc/permiso/` (módulo sistema, opción de módulo, rol usuario, permiso rol usuario):
  menú dinámico y permisos por rol.

### No se porta
- `common/utils/carpeta-archivos.util.ts` (atado a documentos de SIAP), todo el resto de `abc/`.

## Frontend (`D:\SIAP\siap-frontend\src`)

### Se porta tal cual o casi
- `app/core/interceptors/` (`token`, `sesion-expirada`), `app/core/guards/` (`auth`,
  `redirect`, `permiso-rol-usuario`), `app/core/models/http/api-error.model.ts`,
  `app/core/services/sistema/msg.service.ts`.
- `app/core/services/auth/` (`auth.service`, `session.service`); `seleccion-rol-operativo`
  solo si se mantiene esa funcionalidad.
- `app/layout/` (layout, header, navbar, sidebar, sidemenu, boards). Quitar el logo GAMLP.
- `app/shared/utils/` (`notify`, `http-params`, `resource`, `table-filter`, `text`,
  `tree-utils`, `auto-seleccionar`), `app/shared/pipes/` (fecha, moneda),
  `app/shared/pages/acceso-denegado`.
- `app/shared/components/`: `btn`, `combobox` (todo), `notas-dialog`, `editar-valor-dialog`,
  `chip-editable`. `carga-archivo` y `mapa-punto` solo si hacen falta.
- `app/domains/login/`, `app/domains/usuario/`, `app/domains/permiso/`.
- `app.config.ts`, `app.routes.ts` (solo rutas base), `environments/`, `assets/styles/`,
  `eslint.config.js`, `prettier.config.js`, `.editorconfig`.

### Al portar
- **Reemplazar cualquier componente PrimeNG por Angular Material** (si se confirma la
  decisión 4). Antes de copiar un componente, buscar imports de `primeng`.
- `notiflix`, `fontawesome`, `moment` vs `date-fns`: elegir uno por necesidad (hoy SIAP tiene
  `moment` y `date-fns` a la vez).

## Base de datos
- Las tablas de usuario, rol y permisos y sus datos semilla (admin, módulos base) se crean
  con **migraciones** en FARO. No copiar backups `.sql` de SIAP.
