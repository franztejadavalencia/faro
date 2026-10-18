import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { BaseAnulableEntity } from '../entities/base-anulable.entity';
import {
  ACTIVO,
  AHORA_DEL_SERVIDOR,
  anularRegistro,
  assertNoAnulado,
  esActivo,
  sqlActivo,
} from './anulacion.util';

const registro = (cambios: Partial<BaseAnulableEntity> = {}) =>
  ({
    idEstado: 1,
    anulado: false,
    fechaAnulacion: null,
    usuarioAnulacion: null,
    motivoAnulacion: null,
    ...cambios,
  }) as BaseAnulableEntity;

const manager = () => {
  const save = jest.fn((x: object) => Promise.resolve(x));
  return { manager: { save } as unknown as EntityManager, save };
};

describe('anularRegistro', () => {
  it('marca el registro con motivo y fecha y lo guarda', async () => {
    const { manager: m, save } = manager();
    const r = registro();
    await anularRegistro(m, r, '  Error de carga  ', 'la venta');
    expect(r).toMatchObject({
      anulado: true,
      motivoAnulacion: 'Error de carga',
      idEstado: 1, // sigue siendo activo en el sentido de «no eliminado»
    });
    // La fecha sale del reloj de la base (como fecha_registro), no del de Node.
    expect(r.fechaAnulacion).toBe(AHORA_DEL_SERVIDOR);
    expect((AHORA_DEL_SERVIDOR as () => string)()).toBe('CURRENT_TIMESTAMP');
    expect(save).toHaveBeenCalledWith(r);
  });

  it.each([undefined, null, '', '   '])(
    'sin motivo (%p) es 400',
    async (motivo) => {
      const { manager: m, save } = manager();
      await expect(
        anularRegistro(m, registro(), motivo, 'la venta'),
      ).rejects.toThrow('Indique el motivo para anular la venta.');
      expect(save).not.toHaveBeenCalled();
    },
  );

  it('un motivo de más de 500 caracteres es 400', async () => {
    const { manager: m } = manager();
    await expect(
      anularRegistro(m, registro(), 'x'.repeat(501), 'la compra'),
    ).rejects.toThrow(BadRequestException);
  });

  it('uno ya anulado es 400', async () => {
    const { manager: m, save } = manager();
    await expect(
      anularRegistro(m, registro({ anulado: true }), 'Otro', 'la compra 12'),
    ).rejects.toThrow('Ya se anuló la compra 12.');
    expect(save).not.toHaveBeenCalled();
  });
});

describe('«activo» único: id_estado = 1 y no anulado', () => {
  it('el filtro, el SQL y la versión en memoria coinciden', () => {
    expect(ACTIVO).toEqual({ idEstado: 1, anulado: false });
    expect(sqlActivo('v')).toBe('v.id_estado = 1 AND NOT v.anulado');
    expect(esActivo(registro())).toBe(true);
    expect(esActivo(registro({ anulado: true }))).toBe(false);
    expect(esActivo(registro({ idEstado: 0 }))).toBe(false);
  });

  it('un anulado es inmutable', () => {
    expect(() => assertNoAnulado(registro(), 'x')).not.toThrow();
    expect(() =>
      assertNoAnulado(registro({ anulado: true }), 'Está anulado'),
    ).toThrow('Está anulado');
  });
});
