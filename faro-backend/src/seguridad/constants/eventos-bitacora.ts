/** Eventos de `bitacora.evento` (decisión 51). Cada tarea suma los suyos. */
export const EVENTOS_BITACORA = {
  LOGIN_OK: 'LOGIN_OK',
  /**
   * `detalle.motivo` con un `MOTIVO_LOGIN_FALLIDO`. Si el usuario no existe,
   * `detalle.usuario` guarda lo escrito (máx. 100 caracteres) en la bitácora de
   * **plataforma** (`id_negocio` nulo, solo la ve el admin). Nunca la clave
   * (OWASP Logging Cheat Sheet).
   */
  LOGIN_FALLIDO: 'LOGIN_FALLIDO',
  /** Al llegar a `MAX_INTENTOS_FALLIDOS`, por login o por cambio de clave. */
  BLOQUEO_CUENTA: 'BLOQUEO_CUENTA',
  CAMBIO_CLAVE: 'CAMBIO_CLAVE',
  /** Clave actual incorrecta (o cuenta bloqueada) al cambiar la clave. */
  CAMBIO_CLAVE_FALLIDO: 'CAMBIO_CLAVE_FALLIDO',
} as const;

export type EventoBitacora =
  (typeof EVENTOS_BITACORA)[keyof typeof EVENTOS_BITACORA];

export const MOTIVOS_LOGIN_FALLIDO = {
  USUARIO_INEXISTENTE: 'USUARIO_INEXISTENTE',
  BLOQUEADO: 'BLOQUEADO',
  CLAVE_INCORRECTA: 'CLAVE_INCORRECTA',
  NEGOCIO_SUSPENDIDO: 'NEGOCIO_SUSPENDIDO',
} as const;

/** Largo máximo de `detalle.usuario` en un login fallido. */
export const MAX_USUARIO_EN_BITACORA = 100;
