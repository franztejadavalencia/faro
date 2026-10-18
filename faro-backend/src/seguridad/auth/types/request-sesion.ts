import { RequestCon2fa } from './request-2fa';

/**
 * Request tras el guard JWT: además del usuario, el rol vigente que leyó de la
 * fila de `usuario` en este mismo request (no viene del token, así que un
 * cambio de rol rige de inmediato; decisión 99).
 */
export type RequestSesion = RequestCon2fa & {
  rolActual?: { idRolUsuario: number };
};
