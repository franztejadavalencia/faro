import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SaludController } from './salud.controller';

describe('SaludController', () => {
  it('responde ok si la base contesta', async () => {
    const dataSource = {
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const controller = new SaludController(dataSource as unknown as DataSource);

    await expect(controller.verificar()).resolves.toEqual({
      estado: 'ok',
      baseDatos: 'ok',
    });
  });

  it('responde 503 sin detalles de la base si el SELECT 1 falla', async () => {
    const dataSource = {
      query: jest
        .fn()
        .mockRejectedValue(new Error('connect ECONNREFUSED 10.1.2.3:5432')),
    };
    const controller = new SaludController(dataSource as unknown as DataSource);
    jest
      .spyOn(controller['logger'], 'error')
      .mockImplementation(() => undefined);

    const error = await controller.verificar().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    const cuerpo = JSON.stringify(
      (error as ServiceUnavailableException).getResponse(),
    );
    expect(cuerpo).not.toContain('ECONNREFUSED');
    expect(cuerpo).not.toContain('10.1.2.3');
  });
});
