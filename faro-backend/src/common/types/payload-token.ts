import { Request } from 'express';

/**
 * Payload del JWT. Se tipa en `common/` para que el interceptor no importe de
 * `seguridad/` (base-desde-siap.md, regla 1). B4 y B5 lo amplían.
 */
export interface PayloadToken {
  idUsuario: number;
  /** `null` para el admin de plataforma. */
  idNegocio: number | null;
}

/** Request con el usuario que dejó el guard JWT (B4). */
export type RequestConUsuario = Request & { usuarioActual?: PayloadToken };
