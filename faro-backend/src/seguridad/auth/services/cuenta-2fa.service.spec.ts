import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { RequestContextService } from '@common/services/request-context.service';
import { Usuario } from '../../entities/usuario.entity';
import { BitacoraService } from '../../services/bitacora.service';
import { AuthService } from './auth.service';
import { CifradoTotpService } from './cifrado-totp.service';
import { Cuenta2faService } from './cuenta-2fa.service';
import { IntentosService } from './intentos.service';
import {
  ResultadoCodigo,
  SegundoFactorService,
} from './segundo-factor.service';

// bcrypt real tarda ~0,2 s: la «clave correcta» es la que coincide con su hash falso.
jest.mock('../../utils/clave', () => ({
  ...jest.requireActual('../../utils/clave'),
  claveCoincide: jest.fn(
    async (clave: string, hash: string) => hash === `hash(${clave})`,
  ),
}));

function usuario(cambios: Partial<Usuario> = {}): Usuario {
  return {
    idUsuario: 3,
    idNegocio: 7,
    usuario: 'ana',
    clave: 'hash(clave-buena)',
    totpActivo: true,
    totpSecreto: 'cifrado',
    versionSesion: 4,
    intentosFallidos: 0,
    bloqueadoHasta: null,
    rol: { esFijo: true, nombre: 'Dueño' },
    persona: { nombre: 'Ana' },
    ...cambios,
  } as Usuario;
}

function armar(
  fila: Usuario | null,
  codigo: ResultadoCodigo = { valido: true, metodo: 'TOTP' },
) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of [
    'addSelect',
    'innerJoinAndSelect',
    'leftJoinAndSelect',
    'where',
  ]) {
    qb[m] = jest.fn(() => qb);
  }
  qb.getOne = jest.fn().mockResolvedValue(fila);
  const usuarios = {
    createQueryBuilder: jest.fn(() => qb),
  } as unknown as Repository<Usuario>;
  const intentos = {
    sumarFallo: jest.fn().mockResolvedValue(undefined),
    reiniciar: jest.fn().mockResolvedValue(undefined),
  };
  const bitacora = { registrar: jest.fn().mockResolvedValue(undefined) };
  const segundo = {
    comprobarCodigo: jest.fn().mockResolvedValue(codigo),
    desactivar: jest.fn().mockResolvedValue(5),
    regenerarCodigos: jest.fn().mockResolvedValue(['AAAAA-BBBBB']),
    iniciarEnrolamiento: jest.fn().mockResolvedValue({ qr: 'q' }),
    contarCodigosRestantes: jest.fn().mockResolvedValue(8),
  };
  const auth = {
    respuestaSesion: jest.fn(async (u: Usuario) => ({
      estado: 'OK',
      token: `jwt-v${u.versionSesion}`,
    })),
  };
  const contexto = new RequestContextService();
  const servicio = new Cuenta2faService(
    usuarios,
    auth as unknown as AuthService,
    intentos as unknown as IntentosService,
    {} as unknown as CifradoTotpService,
    bitacora as unknown as BitacoraService,
    contexto,
    segundo as unknown as SegundoFactorService,
  );
  const enSesion = <T>(trabajo: () => Promise<T>) =>
    contexto.ejecutarConContexto({ idUsuario: 3, idNegocio: 7 }, trabajo);
  const fallos = () =>
    intentos.sumarFallo.mock.calls.map(
      ([, evento, detalle]: [unknown, string, { motivo: string }]) =>
        `${evento}:${detalle.motivo}`,
    );
  return { servicio, enSesion, intentos, bitacora, segundo, fallos };
}

const reauth = { clave: 'clave-buena', codigo: '123456' };

describe('Cuenta2faService: quién puede usarla', () => {
  it('el admin de plataforma (sin negocio) recibe 403', async () => {
    const { servicio, enSesion } = armar(usuario({ idNegocio: null }));
    await expect(enSesion(() => servicio.estado())).rejects.toThrow(
      ForbiddenException,
    );
    await expect(enSesion(() => servicio.desactivar(reauth))).rejects.toThrow(
      /obligatoria/,
    );
  });

  it('un empleado (rol no fijo) recibe 403 en todas', async () => {
    const { servicio, enSesion } = armar(
      usuario({ rol: { esFijo: false } as Usuario['rol'] }),
    );
    await expect(enSesion(() => servicio.estado())).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      enSesion(() => servicio.configurar({ clave: 'clave-buena' })),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      enSesion(() => servicio.regenerarCodigos(reauth)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('sin sesión (sin usuario en el contexto) es 401', async () => {
    const { servicio } = armar(usuario());
    await expect(servicio.estado()).rejects.toThrow('Sesión inválida');
  });

  it('el estado del dueño trae los códigos que le quedan', async () => {
    const { servicio, enSesion } = armar(usuario());
    await expect(enSesion(() => servicio.estado())).resolves.toEqual({
      activo: true,
      codigosRespaldoRestantes: 8,
    });
  });
});

describe('Cuenta2faService.configurar', () => {
  it('con la clave correcta enrola y lo deja en la bitácora', async () => {
    const { servicio, enSesion, segundo, bitacora } = armar(
      usuario({ totpActivo: false, totpSecreto: null }),
    );
    await enSesion(() => servicio.configurar({ clave: 'clave-buena' }));
    expect(segundo.iniciarEnrolamiento).toHaveBeenCalled();
    expect(bitacora.registrar).toHaveBeenCalledWith('CONFIGURAR_2FA');
  });

  it('con la clave incorrecta es 400, suma al bloqueo y no genera secreto', async () => {
    const { servicio, enSesion, segundo, fallos } = armar(
      usuario({ totpActivo: false, totpSecreto: null }),
    );
    await expect(
      enSesion(() => servicio.configurar({ clave: 'mala' })),
    ).rejects.toThrow(BadRequestException);
    expect(fallos()).toEqual(['VERIFICACION_2FA_FALLIDA:CLAVE_INCORRECTA']);
    expect(segundo.iniciarEnrolamiento).not.toHaveBeenCalled();
  });

  it('con la 2FA ya activa es 409', async () => {
    const { servicio, enSesion } = armar(usuario());
    await expect(
      enSesion(() => servicio.configurar({ clave: 'clave-buena' })),
    ).rejects.toThrow(ConflictException);
  });

  it('con la cuenta bloqueada es 429 sin comparar ni sumar', async () => {
    const { servicio, enSesion, intentos } = armar(
      usuario({
        totpActivo: false,
        bloqueadoHasta: new Date(Date.now() + 60_000),
      }),
    );
    const error = await enSesion(() =>
      servicio.configurar({ clave: 'clave-buena' }),
    ).catch((e: unknown) => e);
    expect((error as HttpException).getStatus()).toBe(429);
    expect(intentos.sumarFallo).not.toHaveBeenCalled();
  });
});

describe('Cuenta2faService.desactivar', () => {
  it('con clave y código correctos apaga, reinicia el contador y devuelve la sesión nueva', async () => {
    const { servicio, enSesion, segundo, intentos, bitacora } =
      armar(usuario());
    const sesion = await enSesion(() => servicio.desactivar(reauth));
    expect(segundo.desactivar).toHaveBeenCalledWith(3);
    expect(sesion).toEqual({ estado: 'OK', token: 'jwt-v5' });
    expect(intentos.reiniciar).toHaveBeenCalled();
    expect(bitacora.registrar).toHaveBeenCalledWith('DESACTIVACION_2FA', {
      metodo: 'TOTP',
    });
  });

  it('con la clave incorrecta es 400, suma, y no mira el código', async () => {
    const { servicio, enSesion, segundo, fallos } = armar(usuario());
    await expect(
      enSesion(() => servicio.desactivar({ ...reauth, clave: 'mala' })),
    ).rejects.toThrow(BadRequestException);
    expect(fallos()).toEqual(['VERIFICACION_2FA_FALLIDA:CLAVE_INCORRECTA']);
    expect(segundo.comprobarCodigo).not.toHaveBeenCalled();
    expect(segundo.desactivar).not.toHaveBeenCalled();
  });

  it('con el código incorrecto es 400 con su motivo y no desactiva', async () => {
    const { servicio, enSesion, segundo, fallos } = armar(usuario(), {
      valido: false,
      motivo: 'CODIGO_INCORRECTO',
    });
    await expect(enSesion(() => servicio.desactivar(reauth))).rejects.toThrow(
      BadRequestException,
    );
    expect(fallos()).toEqual(['VERIFICACION_2FA_FALLIDA:CODIGO_INCORRECTO']);
    expect(segundo.desactivar).not.toHaveBeenCalled();
  });

  it('un código reusado también es 400', async () => {
    const { servicio, enSesion, fallos } = armar(usuario(), {
      valido: false,
      motivo: 'CODIGO_REUSADO',
    });
    await expect(enSesion(() => servicio.desactivar(reauth))).rejects.toThrow(
      BadRequestException,
    );
    expect(fallos()).toEqual(['VERIFICACION_2FA_FALLIDA:CODIGO_REUSADO']);
  });

  it('sin la 2FA activa es 409', async () => {
    const { servicio, enSesion } = armar(usuario({ totpActivo: false }));
    await expect(enSesion(() => servicio.desactivar(reauth))).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('Cuenta2faService.regenerarCodigos', () => {
  it('con clave y código correctos entrega los 10 nuevos y no toca la versión', async () => {
    const { servicio, enSesion, segundo, bitacora } = armar(usuario(), {
      valido: true,
      metodo: 'RESPALDO',
      restantes: 3,
    });
    await expect(
      enSesion(() => servicio.regenerarCodigos(reauth)),
    ).resolves.toEqual({ codigosRespaldo: ['AAAAA-BBBBB'] });
    expect(segundo.desactivar).not.toHaveBeenCalled();
    expect(bitacora.registrar).toHaveBeenCalledWith(
      'CODIGOS_RESPALDO_REGENERADOS',
      { metodo: 'RESPALDO' },
    );
  });

  it('con un fallo es 400 y no cambia los códigos', async () => {
    const { servicio, enSesion, segundo } = armar(usuario(), {
      valido: false,
      motivo: 'CODIGO_INCORRECTO',
    });
    await expect(
      enSesion(() => servicio.regenerarCodigos(reauth)),
    ).rejects.toThrow(BadRequestException);
    expect(segundo.regenerarCodigos).not.toHaveBeenCalled();
  });
});
