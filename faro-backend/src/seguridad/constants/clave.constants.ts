/**
 * Factor de trabajo de bcrypt. OWASP Password Storage Cheat Sheet pide 10 como
 * mínimo; 12 cuesta del orden de 0,2 s por login en esta máquina.
 */
export const BCRYPT_COSTO = 12;

export const CLAVE_MIN_CARACTERES = 8;

/** bcrypt ignora en silencio lo que pasa de 72 **bytes** (no caracteres). */
export const CLAVE_MAX_BYTES = 72;
