import { BadRequestException } from '@nestjs/common';
import { BCRYPT_COSTO } from '../constants/clave.constants';
import { claveCoincide, errorDeClave, hashearClave } from './clave';

describe('errorDeClave', () => {
  it('acepta 8 caracteres', () => {
    expect(errorDeClave('abcd1234')).toBeNull();
  });

  it('rechaza menos de 8 caracteres', () => {
    expect(errorDeClave('abc1234')).toMatch(/al menos 8/);
  });

  it('acepta exactamente 72 bytes y rechaza 73', () => {
    expect(errorDeClave('a'.repeat(72))).toBeNull();
    expect(errorDeClave('a'.repeat(73))).toMatch(/72 bytes/);
  });

  it('mide bytes, no caracteres: 40 «ñ» son 80 bytes', () => {
    const clave = 'ñ'.repeat(40);
    expect(clave).toHaveLength(40);
    expect(errorDeClave(clave)).toMatch(/72 bytes/);
    expect(errorDeClave('ñ'.repeat(36))).toBeNull();
  });
});

describe('hashearClave / claveCoincide', () => {
  it('genera un hash $2b$ con el costo configurado y lo valida', async () => {
    const inicio = Date.now();
    const hash = await hashearClave('clave-de-prueba');
    const ms = Date.now() - inicio;
    expect(hash).toMatch(new RegExp(`^\\$2b\\$${BCRYPT_COSTO}\\$`));
    expect(hash).not.toContain('clave-de-prueba');
    expect(await claveCoincide('clave-de-prueba', hash)).toBe(true);
    expect(await claveCoincide('otra-clave-123', hash)).toBe(false);
    // Costo 12 ≈ 0,2 s; si baja de ~20 ms el factor de trabajo no se está aplicando.
    expect(ms).toBeGreaterThan(20);
  });

  it('rechaza con 400 una clave inválida', async () => {
    await expect(hashearClave('corta')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
