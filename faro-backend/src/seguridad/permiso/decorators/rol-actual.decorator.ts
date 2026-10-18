import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { RequestSesion } from '../../auth/types/request-sesion';

/** El `id_rol_usuario` vigente del usuario de la sesión (lo dejó el guard JWT). */
export const RolActual = createParamDecorator(
  (_dato: unknown, context: ExecutionContext): number => {
    const request = context.switchToHttp().getRequest<RequestSesion>();
    const idRol = request.rolActual?.idRolUsuario;
    if (idRol === undefined) {
      throw new ForbiddenException('La ruta requiere una sesión con rol.');
    }
    return idRol;
  },
);
