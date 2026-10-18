import { Between, In, MoreThan } from 'typeorm';
import { Decimal } from 'decimal.js';
import { decimalTransformer } from './decimal.transformer';

describe('decimalTransformer', () => {
  describe('to (entidad → base)', () => {
    it('Decimal → string sin redondear', () => {
      expect(decimalTransformer.to(new Decimal('12345678901234.1234'))).toBe(
        '12345678901234.1234',
      );
      expect(decimalTransformer.to(new Decimal('-0.0001'))).toBe('-0.0001');
    });

    it('sin notación exponencial', () => {
      expect(decimalTransformer.to(new Decimal('1e21'))).toBe(
        '1000000000000000000000',
      );
      expect(decimalTransformer.to(new Decimal('1e-7'))).toBe('0.0000001');
    });

    it('acepta un string numérico y lo normaliza', () => {
      expect(decimalTransformer.to('40740.50')).toBe('40740.5');
    });

    it('null y undefined pasan tal cual', () => {
      expect(decimalTransformer.to(null)).toBeNull();
      expect(decimalTransformer.to(undefined)).toBeUndefined();
    });

    it('rechaza number (punto flotante)', () => {
      expect(() => decimalTransformer.to(10.5)).toThrow(TypeError);
    });

    it('rechaza NaN e infinito', () => {
      expect(() => decimalTransformer.to(new Decimal(NaN))).toThrow(TypeError);
      expect(() => decimalTransformer.to(new Decimal(Infinity))).toThrow(
        TypeError,
      );
    });

    it('rechaza un string que no es número', () => {
      expect(() => decimalTransformer.to('abc')).toThrow();
    });
  });

  describe('from (base → entidad)', () => {
    it('string de Postgres → Decimal exacto', () => {
      const d = decimalTransformer.from('0.1000') as Decimal;
      expect(Decimal.isDecimal(d)).toBe(true);
      expect(d.plus('0.2').toFixed()).toBe('0.3');
    });

    it('null → null', () => {
      expect(decimalTransformer.from(null)).toBeNull();
      expect(decimalTransformer.from(undefined)).toBeNull();
    });
  });

  it('ida y vuelta conserva 14 enteros y 4 decimales', () => {
    const texto = '99999999999999.9999';
    const ida = decimalTransformer.to(new Decimal(texto)) as string;
    expect((decimalTransformer.from(ida) as Decimal).toFixed(4)).toBe(texto);
  });

  describe('operadores de búsqueda', () => {
    // TypeORM llama a `transformValue` del operador al armar el WHERE.
    it('MoreThan(Decimal) pasa por to() y queda como string', () => {
      const operador = MoreThan(new Decimal('10.50'));
      operador.transformValue(decimalTransformer);
      expect(operador.value).toBe('10.5');
    });

    it('Between(Decimal, Decimal) transforma cada extremo', () => {
      const operador = Between(new Decimal('1.25'), new Decimal('99.99'));
      operador.transformValue(decimalTransformer);
      expect(operador.value).toEqual(['1.25', '99.99']);
    });

    it('In([Decimal…]) transforma cada elemento', () => {
      const operador = In([new Decimal('1'), new Decimal('2.5')]);
      operador.transformValue(decimalTransformer);
      expect(operador.value).toEqual(['1', '2.5']);
    });
  });
});
