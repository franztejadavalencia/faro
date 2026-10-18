/** Fallos seguidos (clave o código) que bloquean la cuenta (decisión 53). */
export const MAX_INTENTOS_FALLIDOS = 5;

/** Duración del bloqueo temporal (decisión 53). Hora real, no `Reloj`. */
export const MINUTOS_BLOQUEO = 15;

/** Vigencia del JWT de sesión (`architecture.md` §11). */
export const VIGENCIA_TOKEN = '12h';

/** Único algoritmo que se firma y se acepta (RFC 8725 §3.1). */
export const ALGORITMO_TOKEN = 'HS256';

/**
 * Siempre el mismo mensaje: no revela si la cuenta existe, está bloqueada o su
 * negocio suspendido. El motivo real va a la bitácora.
 */
export const MENSAJE_CREDENCIALES_INVALIDAS = 'Credenciales inválidas';

export const MENSAJE_SESION_INVALIDA = 'Sesión inválida o expirada';

export const MENSAJE_DEBE_CAMBIAR_CLAVE =
  'Debe cambiar su contraseña antes de continuar.';

/** Vigencia del token temporal de la 2FA (decisión 50). */
export const VIGENCIA_TOKEN_TEMPORAL = '5m';

/** `proposito` del token temporal: el guard solo lo acepta en `/auth/2fa/*`. */
export const PROPOSITO_2FA = '2fa';

/** Emisor de la URI `otpauth://` (lo que muestra la app autenticadora). */
export const EMISOR_TOTP = 'FARO';

/** Códigos de respaldo que se entregan al activar la 2FA (decisión 50). */
export const CANTIDAD_CODIGOS_RESPALDO = 10;

/** `configurar` / `activar` con la 2FA ya activa, o un secreto que cambió (409). */
export const MENSAJE_2FA_ACTIVA =
  'La autenticación en dos pasos ya está activa.';
