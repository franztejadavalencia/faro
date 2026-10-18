import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITMO = 'aes-256-gcm';
const VERSION = 'v1';
const BYTES_IV = 12;
const BYTES_ETIQUETA = 16;

/**
 * El AAD ata el texto cifrado a su usuario: copiar el `totp_secreto` de una
 * fila a otra no se descifra.
 */
const aad = (idUsuario: number): Buffer =>
  Buffer.from(`usuario:${idUsuario}`, 'utf8');

/**
 * Cifra el secreto TOTP con AES-256-GCM (OWASP Cryptographic Storage: IV único
 * por cifrado, clave fuera de la base). Formato `v1:<iv>:<etiqueta>:<cifrado>`
 * en base64; la versión permite rotar la clave más adelante.
 */
export function cifrarSecreto(
  secreto: string,
  clave: Buffer,
  idUsuario: number,
): string {
  const iv = randomBytes(BYTES_IV);
  const cifrador = createCipheriv(ALGORITMO, clave, iv, {
    authTagLength: BYTES_ETIQUETA,
  });
  cifrador.setAAD(aad(idUsuario));
  const cifrado = Buffer.concat([
    cifrador.update(secreto, 'utf8'),
    cifrador.final(),
  ]);
  return [
    VERSION,
    iv.toString('base64'),
    cifrador.getAuthTag().toString('base64'),
    cifrado.toString('base64'),
  ].join(':');
}

/**
 * Descifra lo que dejó `cifrarSecreto`. Lanza si el formato no es el esperado,
 * si el texto o la etiqueta fueron alterados, si es de otro usuario o si la
 * clave no es la misma.
 */
export function descifrarSecreto(
  texto: string,
  clave: Buffer,
  idUsuario: number,
): string {
  const partes = texto.split(':');
  if (partes.length !== 4 || partes[0] !== VERSION) {
    throw new Error('Formato de totp_secreto desconocido');
  }
  const [, iv, etiqueta, cifrado] = partes.map((p) => Buffer.from(p, 'base64'));
  if (iv.length !== BYTES_IV || etiqueta.length !== BYTES_ETIQUETA) {
    throw new Error('Formato de totp_secreto desconocido');
  }
  const descifrador = createDecipheriv(ALGORITMO, clave, iv, {
    authTagLength: BYTES_ETIQUETA,
  });
  descifrador.setAAD(aad(idUsuario));
  descifrador.setAuthTag(etiqueta);
  return Buffer.concat([
    descifrador.update(cifrado),
    descifrador.final(),
  ]).toString('utf8');
}
