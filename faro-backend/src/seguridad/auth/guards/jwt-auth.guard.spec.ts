import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { ES_PUBLICO } from '@common/decorators/publico.decorator';
import { PayloadToken } from '@common/types/payload-token';
import { Usuario } from '../../entities/usuario.entity';
import { PERMITIDO_CON_CLAVE_TEMPORAL } from '../decorators/permitido-con-clave-temporal.decorator';
import { SOLO_TOKEN_TEMPORAL_2FA } from '../decorators/solo-token-temporal-2fa.decorator';
import { PayloadTokenTemporal } from '../services/token.service';
import { RequestCon2fa } from '../types/request-2fa';
import { TokenService } from '../services/token.service';
import { JwtAuthGuard } from './jwt-auth.guard';

const payload: PayloadToken = { idUsuario: 3, idNegocio: 7, versionSesion: 1 };

function filaUsuario(cambios: Partial<Usuario> = {}): Usuario {
  return {
    idUsuario: 3,
    idNegocio: 7,
    idEstado: 1,
    debeCambiarClave: false,
    versionSesion: 1,
    negocio: { idNegocio: 7, estado: 'ACTIVO', idEstado: 1 },
    ...cambios,
  } as Usuario;
}

function armar(opciones: {
  metadatos?: string[];
  fila?: Usuario | null;
  verificado?: PayloadToken | null;
  temporal?: PayloadTokenTemporal | null;
  authorization?: string;
}) {
  const metadatos = new Set(opciones.metadatos ?? []);
  const reflector = {
    getAllAndOverride: jest.fn((clave: string) => metadatos.has(clave)),
  } as unknown as Reflector;
  const verificar = jest
    .fn()
    .mockReturnValue('verificado' in opciones ? opciones.verificado : payload);
  const verificarTemporal = jest
    .fn()
    .mockReturnValue(
      'temporal' in opciones
        ? opciones.temporal
        : { idUsuario: 3, versionSesion: 1 },
    );
  const tokens = { verificar, verificarTemporal } as unknown as TokenService;
  const findOne = jest
    .fn()
    .mockResolvedValue('fila' in opciones ? opciones.fila : filaUsuario());
  const usuarios = { findOne } as unknown as Repository<Usuario>;
  const request = {
    headers: {
      authorization:
        'authorization' in opciones ? opciones.authorization : 'Bearer abc',
    },
  } as RequestCon2fa;
  const contexto = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
  return {
    guard: new JwtAuthGuard(reflector, tokens, usuarios),
    contexto,
    request,
    verificar,
    verificarTemporal,
    findOne,
  };
}

describe('JwtAuthGuard', () => {
  it('una ruta pública pasa sin leer el token ni la base', async () => {
    const { guard, contexto, verificar, findOne } = armar({
      metadatos: [ES_PUBLICO],
    });
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(verificar).not.toHaveBeenCalled();
    expect(findOne).not.toHaveBeenCalled();
  });

  it('con un token válido deja usuarioActual para el contexto', async () => {
    const { guard, contexto, request, verificar } = armar({});
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(verificar).toHaveBeenCalledWith('abc');
    expect(request.usuarioActual).toEqual(payload);
  });

  it('el admin de plataforma (sin negocio) entra', async () => {
    const plataforma = { ...payload, idNegocio: null };
    const { guard, contexto } = armar({
      verificado: plataforma,
      fila: filaUsuario({ idNegocio: null, negocio: null }),
    });
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
  });

  it.each([
    ['sin cabecera', undefined],
    ['sin Bearer', 'Basic abc'],
    ['Bearer vacío', 'Bearer '],
  ])('401 %s', async (_texto, authorization) => {
    const { guard, contexto } = armar({ authorization });
    await expect(guard.canActivate(contexto)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('401 si el token no verifica', async () => {
    const { guard, contexto, findOne } = armar({ verificado: null });
    await expect(guard.canActivate(contexto)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(findOne).not.toHaveBeenCalled();
  });

  it.each([
    ['el usuario no existe', null],
    ['el usuario está dado de baja', filaUsuario({ idEstado: 0 })],
    [
      'el negocio está suspendido',
      filaUsuario({
        negocio: { idNegocio: 7, estado: 'SUSPENDIDO', idEstado: 1 },
      } as Partial<Usuario>),
    ],
    [
      'el negocio está dado de baja',
      filaUsuario({
        negocio: { idNegocio: 7, estado: 'ACTIVO', idEstado: 0 },
      } as Partial<Usuario>),
    ],
    [
      'el idNegocio del token no es el del usuario',
      filaUsuario({ idNegocio: 8 }),
    ],
    ['la versión de sesión cambió', filaUsuario({ versionSesion: 2 })],
  ])('401 si %s', async (_texto, fila) => {
    const { guard, contexto, request } = armar({ fila });
    await expect(guard.canActivate(contexto)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(request.usuarioActual).toBeUndefined();
  });

  it('403 con debe_cambiar_clave en una ruta normal', async () => {
    const { guard, contexto } = armar({
      fila: filaUsuario({ debeCambiarClave: true }),
    });
    await expect(guard.canActivate(contexto)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('con debe_cambiar_clave sí pasa en el cambio de clave', async () => {
    const { guard, contexto, request } = armar({
      metadatos: [PERMITIDO_CON_CLAVE_TEMPORAL],
      fila: filaUsuario({ debeCambiarClave: true }),
    });
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(request.usuarioActual).toEqual(payload);
  });

  describe('rutas de la 2FA (@SoloTokenTemporal2fa)', () => {
    it('con el token temporal deja usuario2fa y no abre sesión', async () => {
      const { guard, contexto, request, verificar, verificarTemporal } = armar({
        metadatos: [SOLO_TOKEN_TEMPORAL_2FA],
      });
      await expect(guard.canActivate(contexto)).resolves.toBe(true);
      expect(verificarTemporal).toHaveBeenCalledWith('abc');
      expect(verificar).not.toHaveBeenCalled();
      expect(request.usuario2fa).toEqual({ idUsuario: 3 });
      expect(request.usuarioActual).toBeUndefined();
    });

    it('401 con un token que no es temporal (p. ej. el de sesión)', async () => {
      const { guard, contexto, findOne } = armar({
        metadatos: [SOLO_TOKEN_TEMPORAL_2FA],
        temporal: null,
      });
      await expect(guard.canActivate(contexto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(findOne).not.toHaveBeenCalled();
    });

    it.each([
      ['el usuario está dado de baja', filaUsuario({ idEstado: 0 })],
      ['la versión de sesión cambió', filaUsuario({ versionSesion: 2 })],
      [
        'el negocio está suspendido',
        filaUsuario({
          negocio: { idNegocio: 7, estado: 'SUSPENDIDO', idEstado: 1 },
        } as Partial<Usuario>),
      ],
    ])('401 si %s', async (_texto, fila) => {
      const { guard, contexto, request } = armar({
        metadatos: [SOLO_TOKEN_TEMPORAL_2FA],
        fila,
      });
      await expect(guard.canActivate(contexto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(request.usuario2fa).toBeUndefined();
    });

    it('debe_cambiar_clave no la frena: la 2FA va antes', async () => {
      const { guard, contexto } = armar({
        metadatos: [SOLO_TOKEN_TEMPORAL_2FA],
        fila: filaUsuario({ debeCambiarClave: true }),
      });
      await expect(guard.canActivate(contexto)).resolves.toBe(true);
    });

    it('en una ruta normal el token temporal no se mira', async () => {
      const { guard, contexto, verificarTemporal } = armar({
        verificado: null,
      });
      await expect(guard.canActivate(contexto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(verificarTemporal).not.toHaveBeenCalled();
    });
  });
});
