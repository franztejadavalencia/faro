import {
  generarCodigoRespaldo,
  normalizarCodigoRespaldo,
} from './codigo-respaldo';

describe('codigo-respaldo', () => {
  it('genera XXXXX-XXXXX con el alfabeto base32, distintos entre sí', () => {
    const codigos = Array.from({ length: 50 }, generarCodigoRespaldo);
    for (const codigo of codigos) {
      expect(codigo).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);
    }
    expect(new Set(codigos).size).toBe(50);
  });

  it('normaliza mayúsculas, guiones y espacios', () => {
    expect(normalizarCodigoRespaldo('abcde-fgh23')).toBe('ABCDEFGH23');
    expect(normalizarCodigoRespaldo(' ABCDE FGH23 ')).toBe('ABCDEFGH23');
    const codigo = generarCodigoRespaldo();
    expect(normalizarCodigoRespaldo(codigo)).toBe(codigo.replace('-', ''));
  });

  it('rechaza largos o caracteres que no pueden ser un código', () => {
    expect(normalizarCodigoRespaldo('123456')).toBeNull();
    expect(normalizarCodigoRespaldo('ABCDE-FGH2')).toBeNull();
    expect(normalizarCodigoRespaldo('ABCDE-FGH20')).toBeNull();
    expect(normalizarCodigoRespaldo('ABCDE-FGH21')).toBeNull();
    expect(normalizarCodigoRespaldo('')).toBeNull();
  });
});
