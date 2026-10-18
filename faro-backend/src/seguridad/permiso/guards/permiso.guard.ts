import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ES_PUBLICO } from '@common/decorators/publico.decorator';
import { RequestSesion } from '../../auth/types/request-sesion';
import {
  PermisoRequerido,
  REQUIERE_PERMISO,
} from '../decorators/requiere-permiso.decorator';
import { SOLO_AUTENTICADO } from '../decorators/solo-autenticado.decorator';
import { PermisoService } from '../services/permiso.service';

export const MENSAJE_SIN_PERMISO = 'No tiene permiso para esta operación.';

/**
 * Guard global, **después** de `JwtAuthGuard`. Denegar por defecto (OWASP
 * Authorization Cheat Sheet, ASVS V4.1.5): una ruta solo pasa si es
 * `@Publico()`, `@SoloAutenticado()` o el rol tiene el `@RequierePermiso()`. El
 * permiso se consulta en cada request; no va en el JWT, así que quitarlo rige
 * en la petición siguiente con el mismo token.
 */
@Injectable()
export class PermisoGuard implements CanActivate {
  private readonly logger = new Logger(PermisoGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permisos: PermisoService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.leer<boolean>(context, ES_PUBLICO) === true) return true;

    const requerido = this.leer<PermisoRequerido>(context, REQUIERE_PERMISO);
    if (requerido) {
      const idRol = context.switchToHttp().getRequest<RequestSesion>()
        .rolActual?.idRolUsuario;
      const permitido =
        idRol !== undefined &&
        (await this.permisos.tiene(idRol, requerido.modulo, requerido.opcion));
      if (!permitido) throw new ForbiddenException(MENSAJE_SIN_PERMISO);
      return true;
    }

    if (this.leer<boolean>(context, SOLO_AUTENTICADO) === true) return true;

    // Es un descuido del desarrollador: lo detecta también `npm test`
    // (`rutas-con-permiso.spec`), pero aquí no se deja pasar nunca.
    this.logger.error(
      `Ruta sin permiso declarado: ${context.getClass().name}.${context.getHandler().name}`,
    );
    throw new ForbiddenException(MENSAJE_SIN_PERMISO);
  }

  private leer<T>(context: ExecutionContext, clave: string): T | undefined {
    return this.reflector.getAllAndOverride<T>(clave, [
      context.getHandler(),
      context.getClass(),
    ]);
  }
}
