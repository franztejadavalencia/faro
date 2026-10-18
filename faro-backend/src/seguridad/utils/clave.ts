import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  BCRYPT_COSTO,
  CLAVE_MAX_BYTES,
  CLAVE_MIN_CARACTERES,
} from '../constants/clave.constants';

/**
 * Regla única de longitud de una clave (B3, B4, B7): mínimo 8 caracteres y
 * máximo 72 **bytes** en UTF-8, porque bcrypt ignora el resto sin avisar y con
 * tildes o ñ 72 caracteres pueden ser más de 72 bytes. Devuelve el mensaje de
 * error, o `null` si la clave sirve.
 */
export function errorDeClave(clave: string): string | null {
  if (clave.length < CLAVE_MIN_CARACTERES) {
    return `La clave debe tener al menos ${CLAVE_MIN_CARACTERES} caracteres.`;
  }
  if (Buffer.byteLength(clave, 'utf8') > CLAVE_MAX_BYTES) {
    return `La clave no puede pasar de ${CLAVE_MAX_BYTES} bytes (los caracteres con tilde o ñ cuentan por más de uno).`;
  }
  return null;
}

/** Hash bcrypt de una clave que cumple `errorDeClave`; si no, 400. */
export async function hashearClave(clave: string): Promise<string> {
  const error = errorDeClave(clave);
  if (error) throw new BadRequestException(error);
  return bcrypt.hash(clave, BCRYPT_COSTO);
}

export function claveCoincide(clave: string, hash: string): Promise<boolean> {
  return bcrypt.compare(clave, hash);
}
