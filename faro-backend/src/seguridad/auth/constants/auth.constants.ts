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
