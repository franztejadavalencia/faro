import { randomInt } from 'crypto';

/** Alfabeto base32 de RFC 4648: 5 bits por carácter, sin 0, 1, 8 ni 9. */
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const LARGO = 10;

/**
 * Un código de respaldo: 10 caracteres (50 bits, `randomInt` sin sesgo),
 * mostrado como `XXXXX-XXXXX`. Con menos de 112 bits se guarda con bcrypt
 * (NIST SP 800-63B §5.1.2.2).
 */
export function generarCodigoRespaldo(): string {
  let codigo = '';
  for (let i = 0; i < LARGO; i++) {
    codigo += ALFABETO[randomInt(ALFABETO.length)];
  }
  return `${codigo.slice(0, 5)}-${codigo.slice(5)}`;
}

/**
 * La forma que se hashea y se compara: mayúsculas, sin guiones ni espacios.
 * `null` si no puede ser un código de respaldo.
 */
export function normalizarCodigoRespaldo(entrada: string): string | null {
  const codigo = entrada.toUpperCase().replace(/[\s-]/g, '');
  return codigo.length === LARGO &&
    [...codigo].every((c) => ALFABETO.includes(c))
    ? codigo
    : null;
}
