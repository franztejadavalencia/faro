import { BadRequestException } from '@nestjs/common';
import {
  fechaDe,
  fechaLegible,
  validateDateRange,
  ZONA_HORARIA,
} from './date.utils';

describe('date.utils', () => {
  it('el proceso corre en UTC (jest-global-setup)', () => {
    expect(process.env.TZ).toBe('UTC');
    expect(ZONA_HORARIA).toBe('America/La_Paz');
  });

  describe('fechaDe', () => {
    it('23:30 en La Paz (03:30 UTC del día siguiente) sigue siendo el día de La Paz', () => {
      expect(fechaDe(new Date('2026-03-16T03:30:00Z'))).toBe('2026-03-15');
    });

    it('cruza la medianoche de La Paz (04:00 UTC)', () => {
      expect(fechaDe(new Date('2026-03-15T03:59:59Z'))).toBe('2026-03-14');
      expect(fechaDe(new Date('2026-03-15T04:00:00Z'))).toBe('2026-03-15');
    });

    it('cruza fin de mes y de año', () => {
      expect(fechaDe(new Date('2027-01-01T03:00:00Z'))).toBe('2026-12-31');
      expect(fechaDe(new Date('2027-01-01T04:00:00Z'))).toBe('2027-01-01');
    });
  });

  it('fechaLegible pasa AAAA-MM-DD a DD/MM/AAAA', () => {
    expect(fechaLegible('2026-10-05')).toBe('05/10/2026');
  });

  describe('validateDateRange', () => {
    it('sin fecha final no valida', () => {
      expect(() => validateDateRange('2026-01-01', null)).not.toThrow();
    });

    it('acepta un rango válido o de un solo día', () => {
      expect(() => validateDateRange('2026-01-01', '2026-01-31')).not.toThrow();
      expect(() => validateDateRange('2026-01-01', '2026-01-01')).not.toThrow();
    });

    it('rechaza fin anterior al inicio', () => {
      expect(() => validateDateRange('2026-02-01', '2026-01-01')).toThrow(
        'La fecha fecha de fin no puede ser anterior a fecha de inicio.',
      );
    });

    it('rechaza fechas no válidas', () => {
      expect(() => validateDateRange('x', '2026-01-01')).toThrow(
        BadRequestException,
      );
    });
  });
});
