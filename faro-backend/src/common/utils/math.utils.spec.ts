import { Decimal, redondearCosto, redondearMonto } from './math.utils';

describe('redondearMonto', () => {
  it.each([
    ['0.005', '0.01'],
    ['-0.005', '-0.01'],
    ['0.004', '0'],
    ['1.005', '1.01'], // con number daría 1.00 (1.005 = 1.00499999…)
    ['2.675', '2.68'],
    ['40740', '40740'],
    ['0.1', '0.1'],
  ])('%s → %s', (entrada, esperado) => {
    expect(redondearMonto(entrada).toFixed()).toBe(esperado);
  });

  it('acepta number, string y Decimal', () => {
    expect(redondearMonto(10.126).toFixed(2)).toBe('10.13');
    expect(redondearMonto('10.126').toFixed(2)).toBe('10.13');
    expect(redondearMonto(new Decimal('10.126')).toFixed(2)).toBe('10.13');
  });

  it('suma de 0.1 + 0.2 exacta con Decimal', () => {
    expect(redondearMonto(new Decimal('0.1').plus('0.2')).toFixed(2)).toBe(
      '0.30',
    );
  });

  it('devuelve un Decimal y no modifica el original', () => {
    const original = new Decimal('1.005');
    const redondeado = redondearMonto(original);
    expect(redondeado).toBeInstanceOf(Decimal);
    expect(original.toFixed()).toBe('1.005');
  });
});

describe('redondearCosto', () => {
  it.each([
    ['0.00005', '0.0001'],
    ['-0.00005', '-0.0001'],
    ['0.00004', '0'],
    ['1.23455', '1.2346'],
    ['60', '60'],
  ])('%s → %s', (entrada, esperado) => {
    expect(redondearCosto(entrada).toFixed()).toBe(esperado);
  });

  it('un costo de 4 decimales sobrevive a redondearMonto solo si se pide', () => {
    expect(redondearCosto('3.33333').toFixed(4)).toBe('3.3333');
    expect(redondearMonto('3.33333').toFixed(2)).toBe('3.33');
  });
});
