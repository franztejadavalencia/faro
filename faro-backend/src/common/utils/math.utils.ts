import { Decimal } from 'decimal.js';

export { Decimal };

/**
 * Redondeo comercial (`ROUND_HALF_UP`, a media hacia arriba en valor absoluto).
 * Se pasa explícito en cada llamada: no se toca la configuración global de
 * `Decimal`.
 */
const REDONDEO = Decimal.ROUND_HALF_UP;

/** Monto en Bs: 2 decimales (`numeric(14,2)`). */
export function redondearMonto(valor: Decimal.Value): Decimal {
  return new Decimal(valor).toDecimalPlaces(2, REDONDEO);
}

/** Costo unitario: 4 decimales (`numeric(14,4)`). */
export function redondearCosto(valor: Decimal.Value): Decimal {
  return new Decimal(valor).toDecimalPlaces(4, REDONDEO);
}
