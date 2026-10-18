import { Request } from 'express';

/**
 * Payload del JWT de sesión. Se tipa en `common/` para que el interceptor no
 * importe de `seguridad/` (base-desde-siap.md, regla 1).
 */
export interface PayloadToken {
  idUsuario: number;
  /** `null` para el admin de plataforma. */
  idNegocio: number | null;
  /**
   * `usuario.version_sesion` al firmar. El guard rechaza un token con una
   * versión vieja: así un cambio de clave cierra las demás sesiones.
   */
  versionSesion: number;
}

/** Request con el usuario que dejó el guard JWT (`seguridad/auth/guards`). */
export type RequestConUsuario = Request & { usuarioActual?: PayloadToken };
