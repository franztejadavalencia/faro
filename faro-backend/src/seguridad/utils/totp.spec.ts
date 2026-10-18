import { base32 } from '@scure/base';
import {
  generarCodigoTotp,
  generarSecretoTotp,
  pasoDelCodigo,
  uriTotp,
} from './totp';

/** Secreto del Apéndice B de RFC 6238 (SHA-1): "12345678901234567890". */
const SECRETO_RFC = base32
  .encode(Buffer.from('12345678901234567890'))
  .replace(/=+$/, '');

describe('totp', () => {
  it('el secreto es de 20 bytes: 32 caracteres base32 sin relleno', () => {
    const secreto = generarSecretoTotp();
    expect(secreto).toMatch(/^[A-Z2-7]{32}$/);
    expect(generarSecretoTotp()).not.toBe(secreto);
  });

  it('vector de RFC 6238 (T = 59 s → 94287082, 6 dígitos: 287082)', async () => {
    expect(await generarCodigoTotp(SECRETO_RFC, 59)).toBe('287082');
    expect(await generarCodigoTotp(SECRETO_RFC, 1111111109)).toBe('081804');
  });

  it('acepta ±1 paso y devuelve el paso del código; ±2 no', async () => {
    const epoch = 1_800_000_000;
    const paso = Math.floor(epoch / 30);
    const secreto = generarSecretoTotp();
    for (const desfase of [-1, 0, 1]) {
      const codigo = await generarCodigoTotp(secreto, epoch + desfase * 30);
      expect(await pasoDelCodigo(secreto, codigo, epoch)).toBe(paso + desfase);
    }
    for (const desfase of [-2, 2]) {
      const codigo = await generarCodigoTotp(secreto, epoch + desfase * 30);
      expect(await pasoDelCodigo(secreto, codigo, epoch)).toBeNull();
    }
  });

  it('un código de otro secreto no coincide', async () => {
    const codigo = await generarCodigoTotp(generarSecretoTotp());
    expect(await pasoDelCodigo(generarSecretoTotp(), codigo)).toBeNull();
  });

  it('URI otpauth con emisor y cuenta', () => {
    const uri = uriTotp('FARO', 'admin', SECRETO_RFC);
    expect(uri).toMatch(/^otpauth:\/\/totp\/FARO:admin\?/);
    expect(uri).toContain(`secret=${SECRETO_RFC}`);
    expect(uri).toContain('issuer=FARO');
  });
});
