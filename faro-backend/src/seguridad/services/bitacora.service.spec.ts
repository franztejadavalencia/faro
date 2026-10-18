import { BadRequestException, ForbiddenException } from '@nestjs/common';
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

describe('BitacoraService.consultar', () => {
  function armarConsulta(
    filas: Partial<Bitacora>[] = [],
    total = filas.length,
  ) {
    const qb: Record<string, jest.Mock> = {};
    for (const m of [
      'leftJoin',
      'select',
      'where',
      'andWhere',
      'orderBy',
      'addOrderBy',
      'skip',
      'take',
    ]) {
      qb[m] = jest.fn(() => qb);
    }
    qb.getManyAndCount = jest.fn().mockResolvedValue([filas, total]);
    const repositorio = {
      createQueryBuilder: jest.fn(() => qb),
    } as unknown as Repository<Bitacora>;
    const contexto = new RequestContextService();
    return {
      qb,
      contexto,
      servicio: new BitacoraService(repositorio, contexto),
    };
  }

  it('falla cerrado: sin negocio en el contexto responde 403 y no consulta', async () => {
    const { servicio, qb } = armarConsulta();
    await expect(servicio.consultar({})).rejects.toThrow(ForbiddenException);
    expect(qb.getManyAndCount).not.toHaveBeenCalled();
  });

  it('el usuario de plataforma (negocio nulo) tampoco consulta', async () => {
    const { servicio, contexto } = armarConsulta();
    await expect(
      contexto.ejecutarConContexto({ idUsuario: 1, idNegocio: null }, () =>
        servicio.consultar({}),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('filtra siempre por el negocio del contexto, aunque el filtro traiga otro dato', async () => {
    const { servicio, contexto, qb } = armarConsulta();
    await contexto.ejecutarConContexto({ idUsuario: 3, idNegocio: 7 }, () =>
      servicio.consultar({ idUsuario: 9, evento: 'LOGIN_OK' }),
    );
    expect(qb.where).toHaveBeenCalledWith('b.idNegocio = :idNegocio', {
      idNegocio: 7,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('b.idUsuario = :idUsuario', {
      idUsuario: 9,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('b.evento = :evento', {
      evento: 'LOGIN_OK',
    });
  });

  it('desde y hasta son días inclusivos en la zona horaria del sistema', async () => {
    const { servicio, contexto, qb } = armarConsulta();
    await contexto.ejecutarConContexto({ idUsuario: 3, idNegocio: 7 }, () =>
      servicio.consultar({ desde: '2026-10-01', hasta: '2026-10-31' }),
    );
    const condiciones = qb.andWhere.mock.calls.map(([sql]: [string]) => sql);
    expect(condiciones.some((s) => s.includes('b.fecha >='))).toBe(true);
    expect(condiciones.some((s) => s.includes('+ 1)::timestamp'))).toBe(true);
    expect(qb.andWhere).toHaveBeenCalledWith(expect.any(String), {
      desde: '2026-10-01',
      zona: 'America/La_Paz',
    });
  });

  it('desde posterior a hasta es 400', async () => {
    const { servicio, contexto } = armarConsulta();
    await expect(
      contexto.ejecutarConContexto({ idUsuario: 3, idNegocio: 7 }, () =>
        servicio.consultar({ desde: '2026-10-31', hasta: '2026-10-01' }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('pagina con 50 por defecto, tope de 100 y orden del más reciente', async () => {
    const { servicio, contexto, qb } = armarConsulta();
    await contexto.ejecutarConContexto({ idUsuario: 3, idNegocio: 7 }, () =>
      servicio.consultar({}),
    );
    expect(qb.take).toHaveBeenCalledWith(50);
    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(qb.orderBy).toHaveBeenCalledWith('b.fecha', 'DESC');
    await contexto.ejecutarConContexto({ idUsuario: 3, idNegocio: 7 }, () =>
      servicio.consultar({ pagina: 3, tamano: 500 }),
    );
    expect(qb.take).toHaveBeenLastCalledWith(100);
    expect(qb.skip).toHaveBeenLastCalledWith(200);
  });

  it('devuelve el nombre del usuario y no el user agent', async () => {
    const fila = {
      idBitacora: 1,
      fecha: new Date('2026-10-18T12:00:00Z'),
      evento: 'LOGIN_OK',
      detalle: null,
      ip: '10.0.0.1',
      url: '/api/auth/login',
      metodo: 'POST',
      usuario: { idUsuario: 3, persona: { nombre: 'Ana', paterno: 'Pérez' } },
    } as unknown as Bitacora;
    const { servicio, contexto } = armarConsulta([fila], 31);
    const pagina = await contexto.ejecutarConContexto(
      { idUsuario: 3, idNegocio: 7 },
      () => servicio.consultar({}),
    );
    expect(pagina.total).toBe(31);
    expect(pagina.items[0].usuario).toEqual({ id: 3, nombre: 'Ana Pérez' });
    expect(pagina.items[0]).not.toHaveProperty('userAgent');
  });

  it('eventos() lista los que existen, ordenados', () => {
    const { servicio } = armarConsulta();
    const eventos = servicio.eventos();
    expect(eventos).toContain('USUARIO_CREADO');
    expect([...eventos].sort()).toEqual(eventos);
  });
});
