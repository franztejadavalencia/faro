import {
  BadRequestException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { RequestContextService } from '@common/services/request-context.service';
import { Usuario } from '../../entities/usuario.entity';
import { BitacoraService } from '../../services/bitacora.service';
import { claveCoincide, hashearClave } from '../../utils/clave';
import { MENSAJE_CREDENCIALES_INVALIDAS } from '../constants/auth.constants';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

jest.mock('../../utils/clave', () => ({
  ...jest.requireActual('../../utils/clave'),
  claveCoincide: jest.fn(),
  hashearClave: jest.fn(async (clave: string) => `hash(${clave})`),
}));

const coincide = claveCoincide as jest.MockedFunction<typeof claveCoincide>;

function usuario(cambios: Partial<Usuario> = {}): Usuario {
  return {
    idUsuario: 3,
    idNegocio: 7,
    usuario: 'ana',
    clave: 'hash-real',
    idEstado: 1,
    debeCambiarClave: false,
    versionSesion: 0,
    intentosFallidos: 0,
    bloqueadoHasta: null,
    persona: { nombre: 'Ana', paterno: 'Pérez', materno: null },
    negocio: { idNegocio: 7, nombre: 'Tienda', estado: 'ACTIVO', idEstado: 1 },
    ...cambios,
  } as Usuario;
}

/** QueryBuilder falso: todo encadena; `getOne` y `execute` devuelven lo pedido. */
function armar(fila: Usuario | null, intentosTrasFallo?: number) {
  const execute = jest.fn().mockResolvedValue({
    raw:
      intentosTrasFallo === undefined
        ? []
        : [{ intentos_fallidos: intentosTrasFallo }],
  });
  const qb: Record<string, jest.Mock> = {};
  for (const metodo of [
    'addSelect',
    'innerJoinAndSelect',
    'leftJoinAndSelect',
    'where',
    'andWhere',
    'update',
    'set',
    'setParameters',
    'returning',
  ]) {
    qb[metodo] = jest.fn(() => qb);
  }
  qb.getOne = jest.fn().mockResolvedValue(fila);
  qb.execute = execute;
  const save = jest.fn(async (u: Usuario) => u);
  const usuarios = {
    createQueryBuilder: jest.fn(() => qb),
    save,
  } as unknown as Repository<Usuario>;
  const firmar = jest.fn().mockReturnValue('jwt');
  const bitacora = {
    registrar: jest.fn().mockResolvedValue(undefined),
    registrarAcceso: jest.fn().mockResolvedValue(undefined),
  };
  const contexto = new RequestContextService();
  const servicio = new AuthService(
    usuarios,
    { firmar } as unknown as TokenService,
    bitacora as unknown as BitacoraService,
    contexto,
  );
  const eventos = () =>
    bitacora.registrarAcceso.mock.calls.map(
      ([evento, , detalle]: [string, unknown, { motivo?: string }]) =>
        detalle?.motivo ? `${evento}:${detalle.motivo}` : evento,
    );
  return { servicio, qb, execute, save, firmar, bitacora, contexto, eventos };
}

const credenciales = { usuario: ' Ana ', clave: 'clave-correcta' };

describe('AuthService.login', () => {
  beforeEach(() => coincide.mockReset());

  it('login correcto: respuesta de §11 y LOGIN_OK', async () => {
    coincide.mockResolvedValue(true);
    const { servicio, firmar, eventos, execute } = armar(usuario());
    await expect(servicio.login(credenciales)).resolves.toEqual({
      estado: 'OK',
      token: 'jwt',
      usuario: {
        id: 3,
        nombre: 'Ana Pérez',
        debeCambiarClave: false,
        negocio: { id: 7, nombre: 'Tienda' },
        rol: null,
      },
      menu: [],
      permisos: [],
    });
    expect(firmar).toHaveBeenCalledWith({
      idUsuario: 3,
      idNegocio: 7,
      versionSesion: 0,
    });
    expect(eventos()).toEqual(['LOGIN_OK']);
    // Sin fallos previos no hay nada que limpiar.
    expect(execute).not.toHaveBeenCalled();
  });

  it('busca sin distinguir mayúsculas y sin espacios', async () => {
    coincide.mockResolvedValue(true);
    const { servicio, qb } = armar(usuario());
    await servicio.login(credenciales);
    expect(qb.where).toHaveBeenCalledWith(
      'lower(u.usuario) = lower(:usuario)',
      {
        usuario: 'Ana',
      },
    );
  });

  it('usuario inexistente: compara contra el hash ficticio y registra lo escrito', async () => {
    coincide.mockResolvedValue(false);
    const { servicio, bitacora } = armar(null);
    await expect(servicio.login(credenciales)).rejects.toThrow(
      new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS),
    );
    expect(hashearClave).toHaveBeenCalled();
    const hashUsado = coincide.mock.calls[0][1];
    expect(hashUsado).toMatch(/^hash\([0-9a-f]{64}\)$/);
    expect(bitacora.registrarAcceso).toHaveBeenCalledWith(
      'LOGIN_FALLIDO',
      null,
      { motivo: 'USUARIO_INEXISTENTE', usuario: ' Ana ' },
    );
  });

  it('recorta a 100 caracteres el usuario escrito', async () => {
    coincide.mockResolvedValue(false);
    const { servicio, bitacora } = armar(null);
    await expect(
      servicio.login({ usuario: 'x'.repeat(150), clave: 'c' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(bitacora.registrarAcceso.mock.calls[0][2].usuario).toHaveLength(100);
  });

  it('cuenta bloqueada: 401 aunque la clave sea correcta y no suma', async () => {
    coincide.mockResolvedValue(true);
    const { servicio, execute, eventos } = armar(
      usuario({ bloqueadoHasta: new Date(Date.now() + 60_000) }),
    );
    await expect(servicio.login(credenciales)).rejects.toThrow(
      new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS),
    );
    expect(execute).not.toHaveBeenCalled();
    expect(eventos()).toEqual(['LOGIN_FALLIDO:BLOQUEADO']);
  });

  it('clave incorrecta: suma con un UPDATE atómico', async () => {
    coincide.mockResolvedValue(false);
    const { servicio, qb, execute, eventos } = armar(usuario(), 1);
    await expect(servicio.login(credenciales)).rejects.toThrow(
      new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS),
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(qb.andWhere).toHaveBeenCalledWith(
      '(bloqueado_hasta IS NULL OR bloqueado_hasta <= now())',
    );
    expect(qb.setParameters).toHaveBeenCalledWith({ maximo: 5, minutos: 15 });
    expect(qb.returning).toHaveBeenCalledWith('intentos_fallidos');
    expect(eventos()).toEqual(['LOGIN_FALLIDO:CLAVE_INCORRECTA']);
  });

  it('el 5.º fallo (contador vuelve a 0) registra BLOQUEO_CUENTA', async () => {
    coincide.mockResolvedValue(false);
    const { servicio, eventos } = armar(usuario({ intentosFallidos: 4 }), 0);
    await expect(servicio.login(credenciales)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(eventos()).toEqual([
      'LOGIN_FALLIDO:CLAVE_INCORRECTA',
      'BLOQUEO_CUENTA',
    ]);
  });

  it('negocio suspendido: 401 con la clave correcta y no suma', async () => {
    coincide.mockResolvedValue(true);
    const { servicio, execute, eventos } = armar(
      usuario({
        negocio: {
          idNegocio: 7,
          nombre: 'Tienda',
          estado: 'SUSPENDIDO',
          idEstado: 1,
        },
      } as Partial<Usuario>),
    );
    await expect(servicio.login(credenciales)).rejects.toThrow(
      new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS),
    );
    expect(execute).not.toHaveBeenCalled();
    expect(eventos()).toEqual(['LOGIN_FALLIDO:NEGOCIO_SUSPENDIDO']);
  });

  it('el bloqueo se revisa antes que la clave (no revela si es correcta)', async () => {
    coincide.mockResolvedValue(false);
    const { servicio, execute, eventos } = armar(
      usuario({ bloqueadoHasta: new Date(Date.now() + 60_000) }),
    );
    await expect(servicio.login(credenciales)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(execute).not.toHaveBeenCalled();
    expect(eventos()).toEqual(['LOGIN_FALLIDO:BLOQUEADO']);
  });

  it('login correcto con fallos previos o bloqueo vencido limpia el contador', async () => {
    coincide.mockResolvedValue(true);
    const { servicio, qb, execute } = armar(
      usuario({
        intentosFallidos: 2,
        bloqueadoHasta: new Date(Date.now() - 1000),
      }),
    );
    await servicio.login(credenciales);
    expect(qb.set).toHaveBeenCalledWith({
      intentosFallidos: 0,
      bloqueadoHasta: null,
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('admin de plataforma: negocio null', async () => {
    coincide.mockResolvedValue(true);
    const { servicio } = armar(usuario({ idNegocio: null, negocio: null }));
    const respuesta = await servicio.login(credenciales);
    expect(respuesta.usuario.negocio).toBeNull();
  });
});

describe('AuthService.cambiarClave', () => {
  beforeEach(() => coincide.mockReset());

  const dto = { claveActual: 'clave-actual-1', claveNueva: 'clave-nueva-1' };

  it('sin usuario en el contexto: 401', async () => {
    const { servicio } = armar(usuario());
    await expect(servicio.cambiarClave(dto)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('guarda el hash nuevo, quita debe_cambiar_clave y sube la versión', async () => {
    coincide.mockResolvedValue(true);
    const { servicio, contexto, save, firmar, bitacora } = armar(
      usuario({ debeCambiarClave: true, versionSesion: 4 }),
    );
    const respuesta = await contexto.ejecutarConContexto(
      { idUsuario: 3, idNegocio: 7 },
      () => servicio.cambiarClave(dto),
    );
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        clave: 'hash(clave-nueva-1)',
        debeCambiarClave: false,
        versionSesion: 5,
      }),
    );
    expect(firmar).toHaveBeenCalledWith(
      expect.objectContaining({ versionSesion: 5 }),
    );
    expect(respuesta.usuario.debeCambiarClave).toBe(false);
    expect(bitacora.registrar).toHaveBeenCalledWith('CAMBIO_CLAVE');
  });

  it('clave actual incorrecta: 400, suma y registra CAMBIO_CLAVE_FALLIDO', async () => {
    coincide.mockResolvedValue(false);
    const { servicio, contexto, execute, save, eventos } = armar(usuario(), 1);
    await expect(
      contexto.ejecutarConContexto({ idUsuario: 3, idNegocio: 7 }, () =>
        servicio.cambiarClave(dto),
      ),
    ).rejects.toThrow(
      new BadRequestException('La clave actual no es correcta.'),
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(eventos()).toEqual(['CAMBIO_CLAVE_FALLIDO:CLAVE_INCORRECTA']);
  });

  it('el 5.º fallo al cambiar la clave también bloquea', async () => {
    coincide.mockResolvedValue(false);
    const { servicio, contexto, eventos } = armar(usuario(), 0);
    await expect(
      contexto.ejecutarConContexto({ idUsuario: 3, idNegocio: 7 }, () =>
        servicio.cambiarClave(dto),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(eventos()).toEqual([
      'CAMBIO_CLAVE_FALLIDO:CLAVE_INCORRECTA',
      'BLOQUEO_CUENTA',
    ]);
  });

  it('cuenta bloqueada: 429 sin comparar la clave', async () => {
    const { servicio, contexto } = armar(
      usuario({ bloqueadoHasta: new Date(Date.now() + 60_000) }),
    );
    const error = await contexto
      .ejecutarConContexto({ idUsuario: 3, idNegocio: 7 }, () =>
        servicio.cambiarClave(dto),
      )
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect(coincide).not.toHaveBeenCalled();
  });

  it.each([
    ['corta', { ...dto, claveNueva: 'corta' }, /al menos 8/],
    ['igual a la actual', { ...dto, claveNueva: dto.claveActual }, /distinta/],
  ])('clave nueva %s: 400', async (_texto, cuerpo, mensaje) => {
    coincide.mockResolvedValue(true);
    const { servicio, contexto, save } = armar(usuario());
    await expect(
      contexto.ejecutarConContexto({ idUsuario: 3, idNegocio: 7 }, () =>
        servicio.cambiarClave(cuerpo),
      ),
    ).rejects.toThrow(mensaje);
    expect(save).not.toHaveBeenCalled();
  });
});
