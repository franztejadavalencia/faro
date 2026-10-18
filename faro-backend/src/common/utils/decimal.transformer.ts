import { ValueTransformer } from 'typeorm';
import { Decimal } from 'decimal.js';

/**
 * `numeric` de Postgres ↔ `Decimal`. El driver entrega `numeric` como string,
 * así que nunca pasa por `number` (decisión 28).
 *
 * `to` también recibe los valores de los operadores de búsqueda
 * (`MoreThan(new Decimal('10'))`, `Between(a, b)`): TypeORM los transforma uno
 * por uno con `FindOperator.transformValue`. No redondea: la precisión la
 * fija el tipo de la columna.
 */
export const decimalTransformer: ValueTransformer = {
  to(valor: Decimal | string | null | undefined): string | null | undefined {
    if (valor === null || valor === undefined) return valor;
    if (typeof valor === 'number') {
      throw new TypeError(
        'Un monto no puede ser number: use Decimal o un string numérico.',
      );
    }
    const decimal = Decimal.isDecimal(valor) ? valor : new Decimal(valor);
    if (!decimal.isFinite()) {
      throw new TypeError('Un monto debe ser un número finito.');
    }
    // `toFixed()` sin argumento: sin notación exponencial y sin redondear.
    return decimal.toFixed();
  },

  from(valor: string | null | undefined): Decimal | null {
    if (valor === null || valor === undefined) return null;
    return new Decimal(valor);
  },
};
