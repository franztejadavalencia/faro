import { Repository } from 'typeorm';
import { RequestContextService } from '@common/services/request-context.service';
import { EVENTOS_BITACORA } from '../constants/eventos-bitacora';
import { Bitacora } from '../entities/bitacora.entity';
import { BitacoraService } from './bitacora.service';

function armar() {
  const save = jest.fn().mockResolvedValue(undefined);
  const repositorio = {
    save,
    create: (datos: Partial<Bitacora>) => datos,
  } as unknown as Repository<Bitacora>;
  const contexto = new RequestContextService();
  return {
    save,
    contexto,
    servicio: new BitacoraService(repositorio, contexto),
  };
}

const contextoHttp = {
  ip: '10.0.0.1',
  userAgent: 'Mozilla/5.0',
  url: '/api/auth/cambiar-clave',
  metodo: 'POST',
};

describe('BitacoraService', () => {
  it('registrar toma usuario, negocio, ip, user agent, url y método del contexto', async () => {
    const { save, contexto, servicio } = armar();
    await contexto.ejecutarConContexto(
      { ...contextoHttp, idUsuario: 3, idNegocio: 7 },
      () => servicio.registrar(EVENTOS_BITACORA.CAMBIO_CLAVE),
    );
    expect(save).toHaveBeenCalledWith({
      evento: 'CAMBIO_CLAVE',
      detalle: null,
      idUsuario: 3,
      idNegocio: 7,
      ip: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
      url: '/api/auth/cambiar-clave',
      metodo: 'POST',
    });
  });

  it('registrar de un usuario de plataforma deja id_negocio nulo', async () => {
    const { save, contexto, servicio } = armar();
    await contexto.ejecutarConContexto({ idUsuario: 1, idNegocio: null }, () =>
      servicio.registrar(EVENTOS_BITACORA.CAMBIO_CLAVE),
    );
    expect(save.mock.calls[0][0]).toMatchObject({
      idUsuario: 1,
      idNegocio: null,
    });
  });

  it('registrarAcceso usa el actor dado y los datos HTTP del contexto', async () => {
    const { save, contexto, servicio } = armar();
    await contexto.ejecutarConContexto(contextoHttp, () =>
      servicio.registrarAcceso(
        EVENTOS_BITACORA.LOGIN_FALLIDO,
        { idUsuario: 4, idNegocio: 9 },
        { motivo: 'CLAVE_INCORRECTA' },
      ),
    );
    expect(save.mock.calls[0][0]).toMatchObject({
      evento: 'LOGIN_FALLIDO',
      idUsuario: 4,
      idNegocio: 9,
      detalle: { motivo: 'CLAVE_INCORRECTA' },
      ip: '10.0.0.1',
    });
  });

  it('registrarAcceso sin actor: usuario y negocio nulos', async () => {
    const { save, servicio } = armar();
    await servicio.registrarAcceso(EVENTOS_BITACORA.LOGIN_FALLIDO, null);
    expect(save.mock.calls[0][0]).toMatchObject({
      idUsuario: null,
      idNegocio: null,
      ip: null,
      userAgent: null,
    });
  });

  it('recorta una ip de más de 64 caracteres', async () => {
    const { save, contexto, servicio } = armar();
    await contexto.ejecutarConContexto({ ip: 'x'.repeat(80) }, () =>
      servicio.registrarAcceso(EVENTOS_BITACORA.LOGIN_OK, null),
    );
    expect(save.mock.calls[0][0].ip).toHaveLength(64);
  });
});
