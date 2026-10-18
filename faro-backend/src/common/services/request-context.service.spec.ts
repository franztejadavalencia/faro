import { RequestContextService } from './request-context.service';

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('RequestContextService', () => {
  const servicio = new RequestContextService();

  it('fuera de un contexto no hay nada', () => {
    expect(servicio.obtenerContexto()).toBeUndefined();
    expect(servicio.obtenerIdUsuario()).toBeUndefined();
    expect(servicio.obtenerIdNegocio()).toBeUndefined();
  });

  it('expone idUsuario e idNegocio', () => {
    servicio.ejecutarConContexto({ idUsuario: 3, idNegocio: 7 }, () => {
      expect(servicio.obtenerIdUsuario()).toBe(3);
      expect(servicio.obtenerIdNegocio()).toBe(7);
    });
  });

  it('conserva ip y userAgent para la bitácora', () => {
    servicio.ejecutarConContexto(
      { ip: '10.0.0.1', userAgent: 'Mozilla/5.0' },
      () => {
        expect(servicio.obtenerContexto()).toMatchObject({
          ip: '10.0.0.1',
          userAgent: 'Mozilla/5.0',
        });
      },
    );
  });

  it('idNegocio null (plataforma) se ve como undefined', () => {
    servicio.ejecutarConContexto({ idUsuario: 3, idNegocio: null }, () => {
      expect(servicio.obtenerIdNegocio()).toBeUndefined();
    });
  });

  it('el contexto sobrevive a un await', async () => {
    await servicio.ejecutarConContexto({ idNegocio: 7 }, async () => {
      await pausa(5);
      expect(servicio.obtenerIdNegocio()).toBe(7);
    });
  });

  it('ejecuciones paralelas no se mezclan', async () => {
    const lecturas = await Promise.all(
      [1, 2, 3, 4].map((id) =>
        servicio.ejecutarConContexto({ idNegocio: id }, async () => {
          await pausa(10 - id);
          return servicio.obtenerIdNegocio();
        }),
      ),
    );
    expect(lecturas).toEqual([1, 2, 3, 4]);
  });
});
