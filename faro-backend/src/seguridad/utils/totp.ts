import { createBase32Plugin, generateSecret } from '@otplib/core';
import { crypto } from '@otplib/plugin-crypto-node';
import { generate, verify } from '@otplib/totp';
import { generateTOTP } from '@otplib/uri';
import { base32 } from '@scure/base';

/**
 * TOTP de RFC 6238 con otplib: SHA-1, 6 dígitos y pasos de 30 s (lo que leen
 * Google Authenticator y similares). Se usan los paquetes `@otplib/*` por
 * separado y `@scure/base` 1.x: el paquete `otplib` arrastra `@scure/base` 2 y
 * `@noble/hashes` 2, solo ESM, que Jest 29 no carga.
 *
 * **Siempre con la hora real** (decisión 61: dato de seguridad), nunca con
 * `Reloj`. Un test que necesite un instante fijo pasa `epoch` (segundos) a
 * otplib, no un `RelojFijo`.
 */

/** Base32 de RFC 4648 sin relleno, como lo escriben las apps autenticadoras. */
const base32SinRelleno = createBase32Plugin({
  name: 'scure-base32',
  encode: (bytes) => base32.encode(bytes).replace(/=+$/, ''),
  decode: (texto) => {
    const limpio = texto.toUpperCase().replace(/=+$/, '');
    return base32.decode(limpio + '='.repeat((8 - (limpio.length % 8)) % 8));
  },
});

const plugins = { crypto, base32: base32SinRelleno };

/** 20 bytes (160 bits, RFC 4226 §4): 32 caracteres base32. */
const BYTES_SECRETO = 20;

/** ±1 paso de 30 s por desfase de reloj (RFC 6238 §5.2, decisión 50). */
const TOLERANCIA_SEGUNDOS = 30;

export function generarSecretoTotp(): string {
  return generateSecret({ ...plugins, length: BYTES_SECRETO });
}

/** `otpauth://totp/<emisor>:<cuenta>?secret=…&issuer=<emisor>` para el QR. */
export function uriTotp(
  emisor: string,
  cuenta: string,
  secreto: string,
): string {
  return generateTOTP({ issuer: emisor, label: cuenta, secret: secreto });
}

/** El código del instante dado (segundos), o del actual. */
export function generarCodigoTotp(
  secreto: string,
  epoch?: number,
): Promise<string> {
  return generate({ ...plugins, secret: secreto, epoch });
}

/**
 * El paso (`floor(epoch / 30)`) en que coincide el código, dentro de ±1 paso,
 * o `null`. El antirreúso con `totp_ultimo_paso` lo hace quien llama, para
 * registrar el motivo.
 */
export async function pasoDelCodigo(
  secreto: string,
  codigo: string,
  epoch?: number,
): Promise<number | null> {
  const resultado = await verify({
    ...plugins,
    secret: secreto,
    token: codigo,
    epoch,
    epochTolerance: TOLERANCIA_SEGUNDOS,
  });
  return resultado.valid ? resultado.timeStep : null;
}
