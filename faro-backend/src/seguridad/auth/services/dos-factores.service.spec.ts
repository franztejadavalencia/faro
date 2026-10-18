import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VariablesEntorno } from '../../../config/env.validation';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { UsuarioCodigoRespaldo } from '../../entities/usuario-codigo-respaldo.entity';
import { Usuario } from '../../entities/usuario.entity';
import { BitacoraService } from '../../services/bitacora.service';
import { generarCodigoTotp, generarSecretoTotp } from '../../utils/totp';
import { MENSAJE_CREDENCIALES_INVALIDAS } from '../constants/auth.constants';
import { AuthService } from './auth.service';
import { CifradoTotpService } from './cifrado-totp.service';
import { DosFactoresService } from './dos-factores.service';
import { IntentosService } from './intentos.service';

// bcrypt real tarda ~0,2 s por hash: aquí basta una función reconocible.
jest.mock('../../utils/clave', () => ({
  ...jest.requireActual('../../utils/clave'),
  hashearClave: jest.fn(async (clave: string) => `hash(${clave})`),
  claveCoincide: jest.fn(
    async (clave: string, hash: string) => hash === `hash(${clave})`,
  ),
}));

const cifrado = new CifradoTotpService({
  get: () => randomBytes(32).toString('base64'),
} as unknown as ConfigService<VariablesEntorno, true>);

function usuario(cambios: Partial<Usuario> = {}): Usuario {
  return {
    idUsuario: 3,
    idNegocio: null,
    usuario: 'admin',
    idEstado: 1,
    debeCambiarClave: false,
    versionSesion: 0,
    totpActivo: false,
    totpSecreto: null,
    totpUltimoPaso: null,
    intentosFallidos: 0,
    bloqueadoHasta: null,
    persona: { nombre: 'Ada', paterno: 'Admin', materno: null },
    negocio: null,
    ...cambios,
  } as Usuario;
}

/** Un usuario con secreto cifrado (y el secreto en claro, para el test). */
function conSecreto(cambios: Partial<Usuario> = {}) {
  const secreto = generarSecretoTotp();
  return {
    secreto,
    fila: usuario({ totpSecreto: cifrado.cifrar(secreto, 3), ...cambios }),
  };
}

/**
 * QueryBuilder falso: todo encadena; `getOne` devuelve la fila y cada
 * `execute` devuelve el siguiente `raw` de la lista (o `[{}]`).
 */
function armar(
  fila: Usuario,
  opciones: { raws?: unknown[][]; pendientes?: UsuarioCodigoRespaldo[] } = {},
) {
  const raws = [...(opciones.raws ?? [])];
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
  qb.execute = jest.fn(async () => ({ raw: raws.shift() ?? [{}] }));
  const usuarios = {
    createQueryBuilder: jest.fn(() => qb),
  } as unknown as Repository<Usuario>;
  const codigos = {
    createQueryBuilder: jest.fn(() => qb),
    find: jest.fn().mockResolvedValue(opciones.pendientes ?? []),
  } as unknown as Repository<UsuarioCodigoRespaldo>;
  const manager = {
    createQueryBuilder: jest.fn(() => qb),
    delete: jest.fn(),
    insert: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn((trabajo: (m: EntityManager) => Promise<unknown>) =>
      trabajo(manager as unknown as EntityManager),
    ),
  } as unknown as DataSource;
  const bitacora = {
    registrar: jest.fn().mockResolvedValue(undefined),
    registrarAcceso: jest.fn().mockResolvedValue(undefined),
  };
  const intentos = {
    sumarFallo: jest.fn().mockResolvedValue(undefined),
    reiniciar: jest.fn().mockResolvedValue(undefined),
  };
  const respuestaSesion = jest.fn((u: Usuario) => ({
    estado: 'OK',
    token: `jwt-v${u.versionSesion}`,
  }));
  const servicio = new DosFactoresService(
    usuarios,
    codigos,
    dataSource,
    { respuestaSesion } as unknown as AuthService,
    intentos as unknown as IntentosService,
    cifrado,
    bitacora as unknown as BitacoraService,
  );
  const eventos = () =>
    bitacora.registrarAcceso.mock.calls.map(
      ([evento, , detalle]: [string, unknown, { motivo?: string } | null]) =>
        detalle?.motivo ? `${evento}:${detalle.motivo}` : evento,
    );
  const fallos = () =>
    intentos.sumarFallo.mock.calls.map(
      ([, evento, detalle]: [unknown, string, { motivo: string }]) =>
        `${evento}:${detalle.motivo}`,
    );
  return {
    servicio,
    qb,
    manager,
    dataSource,
    intentos,
    eventos,
    fallos,
    codigos,
  };
}

const credencialesInvalidas = new UnauthorizedException(
  MENSAJE_CREDENCIALES_INVALIDAS,
);
const bloqueado = { bloqueadoHasta: new Date(Date.now() + 60_000) };

describe('DosFactoresService.configurar', () => {
  it('guarda el secreto cifrado y entrega QR, URI y clave manual', async () => {
    const { servicio, qb, eventos } = armar(usuario());
    const respuesta = await servicio.configurar(3);

    expect(respuesta.qr).toMatch(/^data:image\/png;base64,/);
    expect(respuesta.uri).toMatch(/^otpauth:\/\/totp\/FARO:admin\?/);
    const secreto = new URL(respuesta.uri).searchParams.get('secret') ?? '';
    expect(respuesta.claveManual.replace(/ /g, '')).toBe(secreto);
    expect(respuesta.claveManual).toMatch(/^([A-Z2-7]{4} ){7}[A-Z2-7]{4}$/);

    const guardado = qb.set.mock.calls[0][0] as Partial<Usuario>;
    expect(guardado.totpSecreto).toMatch(/^v1:/);
    expect(guardado.totpSecreto).not.toContain(secreto);
    expect(cifrado.descifrar(guardado.totpSecreto ?? '', 3)).toBe(secreto);
    expect(guardado).toMatchObject({
      totpUltimoPaso: null,
      usuarioModificacion: 3,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('totp_activo = false');
    expect(eventos()).toEqual(['CONFIGURAR_2FA']);
  });

  it('409 con la 2FA ya activa', async () => {
    const { servicio, qb } = armar(conSecreto({ totpActivo: true }).fila);
    await expect(servicio.configurar(3)).rejects.toThrow(ConflictException);
    expect(qb.execute).not.toHaveBeenCalled();
  });

  it('409 si se activó entre la lectura y el UPDATE', async () => {
    const { servicio } = armar(usuario(), { raws: [[]] });
    await expect(servicio.configurar(3)).rejects.toThrow(ConflictException);
  });

  it('cuenta bloqueada: 401 sin generar nada', async () => {
    const { servicio, qb, intentos } = armar(usuario(bloqueado));
    await expect(servicio.configurar(3)).rejects.toThrow(credencialesInvalidas);
    expect(qb.execute).not.toHaveBeenCalled();
    expect(intentos.sumarFallo).not.toHaveBeenCalled();
  });
});

describe('DosFactoresService.verificar', () => {
  it('enrolamiento: el primer código activa, sube la versión y da 10 códigos', async () => {
    const { secreto, fila } = conSecreto();
    const { servicio, qb, manager, eventos, intentos } = armar(fila, {
      raws: [[{ version_sesion: 1 }]],
    });
    const respuesta = await servicio.verificar(
      3,
      await generarCodigoTotp(secreto),
    );

    expect(respuesta).toMatchObject({ estado: 'OK', token: 'jwt-v1' });
    const codigos = (respuesta as { codigosRespaldo: string[] })
      .codigosRespaldo;
    expect(codigos).toHaveLength(10);
    expect(new Set(codigos).size).toBe(10);
    expect(qb.set.mock.calls[0][0]).toMatchObject({
      totpActivo: true,
      usuarioModificacion: 3,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('totp_secreto = :secreto', {
      secreto: fila.totpSecreto,
    });
    expect(manager.delete).toHaveBeenCalledWith(UsuarioCodigoRespaldo, {
      idUsuario: 3,
    });
    const filas = manager.insert.mock.calls[0][1] as { hash: string }[];
    expect(filas.map((f) => f.hash)).toEqual(
      codigos.map((c) => `hash(${c.replace('-', '')})`),
    );
    expect(intentos.reiniciar).toHaveBeenCalled();
    expect(eventos()).toEqual(['ACTIVACION_2FA']);
  });

  it('enrolamiento: 409 si el secreto cambió o ya se activó', async () => {
    const { secreto, fila } = conSecreto();
    const { servicio } = armar(fila, { raws: [[]] });
    await expect(
      servicio.verificar(3, await generarCodigoTotp(secreto)),
    ).rejects.toThrow(ConflictException);
  });

  it('con la 2FA activa: TOTP correcto abre la sesión y guarda el paso', async () => {
    const { secreto, fila } = conSecreto({ totpActivo: true });
    const { servicio, qb, eventos, intentos } = armar(fila, {
      raws: [[{ id_usuario: 3 }]],
    });
    await expect(
      servicio.verificar(3, ` ${await generarCodigoTotp(secreto)} `),
    ).resolves.toEqual({ estado: 'OK', token: 'jwt-v0' });
    const paso = Math.floor(Date.now() / 1000 / 30);
    const guardado = qb.set.mock.calls[0][0] as { totpUltimoPaso: number };
    expect(Math.abs(guardado.totpUltimoPaso - paso)).toBeLessThanOrEqual(1);
    expect(intentos.reiniciar).toHaveBeenCalled();
    expect(eventos()).toEqual(['LOGIN_OK']);
  });

  it('paso ya usado (el UPDATE no toca filas): CODIGO_REUSADO y suma', async () => {
    const { secreto, fila } = conSecreto({ totpActivo: true });
    const { servicio, fallos, intentos } = armar(fila, { raws: [[]] });
    await expect(
      servicio.verificar(3, await generarCodigoTotp(secreto)),
    ).rejects.toThrow(credencialesInvalidas);
    expect(fallos()).toEqual(['VERIFICACION_2FA_FALLIDA:CODIGO_REUSADO']);
    expect(intentos.reiniciar).not.toHaveBeenCalled();
  });

  it('código incorrecto: CODIGO_INCORRECTO y suma', async () => {
    const { fila } = conSecreto({ totpActivo: true });
    const { servicio, fallos } = armar(fila);
    const otro = await generarCodigoTotp(generarSecretoTotp());
    await expect(servicio.verificar(3, otro)).rejects.toThrow(
      credencialesInvalidas,
    );
    expect(fallos()).toEqual(['VERIFICACION_2FA_FALLIDA:CODIGO_INCORRECTO']);
  });

  it('sin configurar: SIN_CONFIGURAR y suma', async () => {
    const { servicio, fallos } = armar(usuario());
    await expect(servicio.verificar(3, '123456')).rejects.toThrow(
      credencialesInvalidas,
    );
    expect(fallos()).toEqual(['VERIFICACION_2FA_FALLIDA:SIN_CONFIGURAR']);
  });

  it('cuenta bloqueada: 401 sin mirar el código ni sumar', async () => {
    const { secreto, fila } = conSecreto({ totpActivo: true, ...bloqueado });
    const { servicio, intentos, eventos, qb } = armar(fila);
    await expect(
      servicio.verificar(3, await generarCodigoTotp(secreto)),
    ).rejects.toThrow(credencialesInvalidas);
    expect(intentos.sumarFallo).not.toHaveBeenCalled();
    expect(qb.execute).not.toHaveBeenCalled();
    expect(eventos()).toEqual(['VERIFICACION_2FA_FALLIDA:BLOQUEADO']);
  });

  describe('código de respaldo', () => {
    const pendientes = [
      { idUsuarioCodigoRespaldo: 11, hash: 'hash(AAAAABBBBB)' },
      { idUsuarioCodigoRespaldo: 12, hash: 'hash(CCCCCDDDDD)' },
    ] as UsuarioCodigoRespaldo[];

    it('sirve: lo marca usado y registra cuántos quedan', async () => {
      const { fila } = conSecreto({ totpActivo: true });
      const { servicio, qb, codigos, intentos } = armar(fila, {
        pendientes,
        raws: [[{ id_usuario_codigo_respaldo: 12 }]],
      });
      await expect(servicio.verificar(3, 'ccccc-ddddd')).resolves.toEqual({
        estado: 'OK',
        token: 'jwt-v0',
      });
      expect(qb.where).toHaveBeenCalledWith(
        'id_usuario_codigo_respaldo = :id',
        { id: 12 },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('usado_en IS NULL');
      expect(codigos.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ idUsuario: 3 }),
        }),
      );
      expect(intentos.reiniciar).toHaveBeenCalled();
    });

    it('usado en otra petición a la vez (UPDATE sin filas): 401', async () => {
      const { fila } = conSecreto({ totpActivo: true });
      const { servicio, fallos } = armar(fila, { pendientes, raws: [[]] });
      await expect(servicio.verificar(3, 'AAAAA-BBBBB')).rejects.toThrow(
        credencialesInvalidas,
      );
      expect(fallos()).toEqual(['VERIFICACION_2FA_FALLIDA:CODIGO_INCORRECTO']);
    });

    it('uno que no está entre los pendientes: 401 y suma', async () => {
      const { fila } = conSecreto({ totpActivo: true });
      const { servicio, fallos } = armar(fila, { pendientes });
      await expect(servicio.verificar(3, 'EEEEE-FFFFF')).rejects.toThrow(
        credencialesInvalidas,
      );
      expect(fallos()).toHaveLength(1);
    });

    it('no sirve para enrolar (2FA aún no activa)', async () => {
      const { fila } = conSecreto();
      const { servicio, codigos, fallos } = armar(fila, { pendientes });
      await expect(servicio.verificar(3, 'AAAAA-BBBBB')).rejects.toThrow(
        credencialesInvalidas,
      );
      expect(codigos.find).not.toHaveBeenCalled();
      expect(fallos()).toEqual(['VERIFICACION_2FA_FALLIDA:CODIGO_INCORRECTO']);
    });
  });
});
