import { RequestConUsuario } from '@common/types/payload-token';

/**
 * Request de una ruta `@SoloTokenTemporal2fa()`: el guard deja aquí el usuario
 * del token temporal. No es una sesión: `usuarioActual` queda vacío y el
 * contexto no tiene usuario ni negocio.
 */
export type RequestCon2fa = RequestConUsuario & {
  usuario2fa?: { idUsuario: number };
};
