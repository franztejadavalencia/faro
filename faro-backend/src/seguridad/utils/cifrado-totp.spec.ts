import { randomBytes } from 'crypto';
import { cifrarSecreto, descifrarSecreto } from './cifrado-totp';

describe('cifrado-totp', () => {
  const clave = randomBytes(32);
  const secreto = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

  it('ida y vuelta, con formato v1 y sin el secreto a la vista', () => {
    const texto = cifrarSecreto(secreto, clave, 5);
    expect(texto).toMatch(/^v1:[^:]+:[^:]+:[^:]+$/);
    expect(texto).not.toContain(secreto);
    expect(descifrarSecreto(texto, clave, 5)).toBe(secreto);
  });

  it('dos cifrados del mismo secreto dan textos distintos (IV aleatorio)', () => {
    expect(cifrarSecreto(secreto, clave, 5)).not.toBe(
      cifrarSecreto(secreto, clave, 5),
    );
  });

  it('el texto de otro usuario no se descifra (AAD)', () => {
    const texto = cifrarSecreto(secreto, clave, 5);
    expect(() => descifrarSecreto(texto, clave, 6)).toThrow();
  });

  it('con otra clave no se descifra', () => {
    const texto = cifrarSecreto(secreto, clave, 5);
    expect(() => descifrarSecreto(texto, randomBytes(32), 5)).toThrow();
  });

  it('un cifrado o una etiqueta alterados no se descifran', () => {
    const [v, iv, etiqueta, cifrado] = cifrarSecreto(secreto, clave, 5).split(
      ':',
    );
    const alterar = (b64: string): string => {
      const bytes = Buffer.from(b64, 'base64');
      bytes[0] ^= 1;
      return bytes.toString('base64');
    };
    expect(() =>
      descifrarSecreto([v, iv, etiqueta, alterar(cifrado)].join(':'), clave, 5),
    ).toThrow();
    expect(() =>
      descifrarSecreto([v, iv, alterar(etiqueta), cifrado].join(':'), clave, 5),
    ).toThrow();
  });

  it('rechaza un formato desconocido', () => {
    expect(() => descifrarSecreto(secreto, clave, 5)).toThrow(/Formato/);
    expect(() => descifrarSecreto('v2:a:b:c', clave, 5)).toThrow(/Formato/);
  });
});
