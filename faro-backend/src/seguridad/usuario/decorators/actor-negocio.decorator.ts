import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { RequestSesion } from '../../auth/types/request-sesion';
import { ActorNegocio as Actor } from '../types/actor-gestion';

/**
 * Quien hace la petición, de la sesión (nunca del body ni de la ruta): su
 * `idUsuario` del token y su rol vigente de la fila que leyó el guard JWT.
 */
export const ActorNegocio = createParamDecorator(
  (_dato: unknown, context: ExecutionContext): Actor => {
    const request = context.switchToHttp().getRequest<RequestSesion>();
    const idUsuario = request.usuarioActual?.idUsuario;
    const idRolUsuario = request.rolActual?.idRolUsuario;
    if (idUsuario === undefined || idRolUsuario === undefined) {
      throw new ForbiddenException('La ruta requiere una sesión con rol.');
    }
    return { tipo: 'NEGOCIO', idUsuario, idRolUsuario };
  },
);
