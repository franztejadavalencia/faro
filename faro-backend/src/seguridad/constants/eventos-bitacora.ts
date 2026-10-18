/** Eventos de `bitacora.evento` (decisión 51). Cada tarea suma los suyos. */
export const EVENTOS_BITACORA = {
  /** Sesión abierta. Tras la 2FA, `detalle.metodo` (`TOTP` | `RESPALDO`). */
  LOGIN_OK: 'LOGIN_OK',
  /** Clave correcta; falta configurar o verificar la 2FA (sin sesión aún). */
  LOGIN_2FA_PENDIENTE: 'LOGIN_2FA_PENDIENTE',
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
  /** Se generó un secreto TOTP pendiente (QR entregado). Con la IP del contexto. */
  CONFIGURAR_2FA: 'CONFIGURAR_2FA',
  /** Primer código correcto: la 2FA queda activa y se entregan los códigos. */
  ACTIVACION_2FA: 'ACTIVACION_2FA',
  /** `detalle.motivo` con un `MOTIVO_2FA_FALLIDO`. Nunca el código. */
  VERIFICACION_2FA_FALLIDA: 'VERIFICACION_2FA_FALLIDA',
  /** Un rol cambió sus permisos: `detalle` = rol, `activados` y `desactivados`. */
  CAMBIO_PERMISOS: 'CAMBIO_PERMISOS',
  ROL_CREADO: 'ROL_CREADO',
  ROL_ACTUALIZADO: 'ROL_ACTUALIZADO',
  ROL_ELIMINADO: 'ROL_ELIMINADO',
} as const;

export type EventoBitacora =
  (typeof EVENTOS_BITACORA)[keyof typeof EVENTOS_BITACORA];

export const MOTIVOS_LOGIN_FALLIDO = {
  USUARIO_INEXISTENTE: 'USUARIO_INEXISTENTE',
  BLOQUEADO: 'BLOQUEADO',
  CLAVE_INCORRECTA: 'CLAVE_INCORRECTA',
  NEGOCIO_SUSPENDIDO: 'NEGOCIO_SUSPENDIDO',
} as const;

export const MOTIVOS_2FA_FALLIDO = {
  BLOQUEADO: 'BLOQUEADO',
  CODIGO_INCORRECTO: 'CODIGO_INCORRECTO',
  /** El código es de un paso ya aceptado (RFC 6238 §5.2, ASVS V2.8.5). */
  CODIGO_REUSADO: 'CODIGO_REUSADO',
  /** Sin secreto: no se llamó a configurar. */
  SIN_CONFIGURAR: 'SIN_CONFIGURAR',
} as const;

/** Largo máximo de `detalle.usuario` en un login fallido. */
export const MAX_USUARIO_EN_BITACORA = 100;
