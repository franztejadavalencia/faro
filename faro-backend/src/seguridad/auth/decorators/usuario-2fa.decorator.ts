import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { MENSAJE_SESION_INVALIDA } from '../constants/auth.constants';
import { RequestCon2fa } from '../types/request-2fa';

/**
 * El `idUsuario` del token temporal que validó el guard. Nunca sale del body
 * ni de la ruta (la falla de CONTROLADOR que evita la decisión 50).
 */
export const Usuario2fa = createParamDecorator(
  (_dato: unknown, context: ExecutionContext): number => {
    const request = context.switchToHttp().getRequest<RequestCon2fa>();
    const idUsuario = request.usuario2fa?.idUsuario;
    if (idUsuario === undefined) {
      throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);
    }
    return idUsuario;
  },
);
