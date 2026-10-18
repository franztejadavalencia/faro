import { Reloj } from './reloj';
import { RelojFijo } from './reloj-fijo';
import { RelojSistema } from './reloj-sistema';

describe('RelojSistema', () => {
  it('devuelve la hora real', () => {
    const antes = Date.now();
    const ahora = new RelojSistema().ahora().getTime();
    expect(ahora).toBeGreaterThanOrEqual(antes);
    expect(ahora).toBeLessThanOrEqual(Date.now());
  });

  it('hoy() es el día de La Paz del instante actual', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-16T03:30:00Z'));
    try {
      expect(new RelojSistema().hoy()).toBe('2026-03-15');
    } finally {
      jest.useRealTimers();
    }
  });

  it('es un Reloj (token de inyección)', () => {
    expect(new RelojSistema()).toBeInstanceOf(Reloj);
  });
});

describe('RelojFijo', () => {
  it('con AAAA-MM-DD, hoy() da ese día aunque el proceso esté en UTC', () => {
    expect(new RelojFijo('2026-05-15').hoy()).toBe('2026-05-15');
  });

  it('no se mueve solo', async () => {
    const reloj = new RelojFijo('2026-05-15');
    const a = reloj.ahora().getTime();
    await new Promise((r) => setTimeout(r, 15));
    expect(reloj.ahora().getTime()).toBe(a);
  });

  it('fijar cambia el día', () => {
    const reloj = new RelojFijo('2026-05-15');
    reloj.fijar('2026-01-31');
    expect(reloj.hoy()).toBe('2026-01-31');
  });

  it('avanzar suma días y cruza fin de mes y de año', () => {
    const reloj = new RelojFijo('2026-12-30');
    reloj.avanzar(1);
    expect(reloj.hoy()).toBe('2026-12-31');
    reloj.avanzar(1);
    expect(reloj.hoy()).toBe('2027-01-01');
    reloj.avanzar(-2);
    expect(reloj.hoy()).toBe('2026-12-30');
  });

  it('acepta un instante: 03:30 UTC es la noche anterior en La Paz', () => {
    expect(new RelojFijo(new Date('2026-03-16T03:30:00Z')).hoy()).toBe(
      '2026-03-15',
    );
  });

  it('ahora() devuelve una copia: mutarla no mueve el reloj', () => {
    const reloj = new RelojFijo('2026-05-15');
    reloj.ahora().setFullYear(2000);
    expect(reloj.hoy()).toBe('2026-05-15');
  });

  it('rechaza una fecha no válida', () => {
    expect(() => new RelojFijo('no-es-fecha')).toThrow('Fecha no válida');
  });
});
