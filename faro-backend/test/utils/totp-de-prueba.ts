import { createBase32Plugin } from '@otplib/core';
import { crypto } from '@otplib/plugin-crypto-node';
import { generate } from '@otplib/totp';
import { base32 } from '@scure/base';

/**
 * Genera el código como lo haría la app del usuario: directo con otplib, sin
 * pasar por `src/seguridad/utils/totp.ts`. `epoch` en segundos; sin él, la
 * hora real (decisión 61).
 */
export function codigoTotp(secreto: string, epoch?: number): Promise<string> {
  return generate({
    secret: secreto,
    epoch,
    crypto,
    base32: createBase32Plugin({
      name: 'scure-base32',
      encode: (bytes) => base32.encode(bytes).replace(/=+$/, ''),
      decode: (texto) =>
        base32.decode(texto + '='.repeat((8 - (texto.length % 8)) % 8)),
    }),
  });
}

/** El secreto que trae la `uri` de `POST /api/auth/2fa/configurar`. */
export function secretoDeUri(uri: string): string {
  const secreto = new URL(uri).searchParams.get('secret');
  if (!secreto) throw new Error(`URI sin secreto: ${uri}`);
  return secreto;
}
