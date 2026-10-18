import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { NegocioRepositoryFactory } from '@common/utils/negocio-repository.factory';
import { Usuario } from '../../entities/usuario.entity';
import { PermisoService } from '../../permiso/services/permiso.service';
import { PersonaService } from '../../persona/services/persona.service';
import { BitacoraService } from '../../services/bitacora.service';
import { ActorNegocio } from '../types/actor-gestion';
import { UsuarioClaveService } from './usuario-clave.service';
import { UsuarioService } from './usuario.service';

// bcrypt real tarda ~0,2 s por hash: aquí basta una función reconocible.
jest.mock('../../utils/clave', () => ({
  ...jest.requireActual('../../utils/clave'),
  hashearClave: jest.fn(async (clave: string) => `hash(${clave})`),
}));

const editor: ActorNegocio = {
  tipo: 'NEGOCIO',
  idUsuario: 1,
  idRolUsuario: 10,
};

const p = (modulo: string, opcion: string) => ({ modulo, opcion });
/** Permisos por rol: 10 = editor, 20 = igual, 30 = superior, 40 = fijo. */
const PERMISOS: Record<number, ReturnType<typeof p>[]> = {
  10: [p('usuarios', 'editar'), p('pos', 'ver')],
  20: [p('pos', 'ver')],
  30: [p('pos', 'ver'), p('productos', 'ver_costos')],
};

function objetivo(cambios: Partial<Usuario> = {}): Usuario {
  return {
    idUsuario: 2,
    idEstado: 1,
    idRolUsuario: 20,
    usuario: 'beto',
    bloqueadoHasta: null,
    debeCambiarClave: false,
    totpActivo: false,
    persona: { idPersona: 5, nombre: 'Beto' },
    rol: { idRolUsuario: 20, nombre: 'Cajero', esFijo: false },
    ...cambios,
  } as Usuario;
}

function armar(
  opciones: { usuario?: Usuario | null; loginTomado?: boolean } = {},
) {
  const fila = opciones.usuario === undefined ? objetivo() : opciones.usuario;
  const roles: Record<number, unknown> = {
    20: { idRolUsuario: 20, nombre: 'Cajero', esFijo: false },
    30: { idRolUsuario: 30, nombre: 'Gerente', esFijo: false },
    40: { idRolUsuario: 40, nombre: 'Dueño', esFijo: true },
  };
  const repoUsuario = { findOne: jest.fn().mockResolvedValue(fila) };
  const repoRol = {
    requireActiveEntity: jest.fn(
      async ({ idRolUsuario }: { idRolUsuario: number }) => {
        const rol = roles[idRolUsuario];
        if (!rol) throw new NotFoundException('No se encontró el rol');
        return rol;
      },
    ),
  };
  const negocios = {
    para: jest.fn((entidad: { name: string }) =>
      entidad.name === 'Usuario' ? repoUsuario : repoRol,
    ),
  } as unknown as NegocioRepositoryFactory;
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getExists: jest.fn().mockResolvedValue(opciones.loginTomado ?? false),
  };
  const usuarios = {
    createQueryBuilder: jest.fn(() => qb),
    update: jest.fn().mockResolvedValue(undefined),
  } as unknown as Repository<Usuario>;
  const dataSource = {
    transaction: jest.fn(),
  } as unknown as DataSource;
  const permisos = {
    permisosDelRol: jest.fn(async (id: number) => PERMISOS[id] ?? []),
  } as unknown as PermisoService;
  const claves = {
    restablecer: jest.fn().mockResolvedValue(undefined),
    desbloquear: jest.fn().mockResolvedValue(undefined),
  };
  const bitacora = { registrar: jest.fn().mockResolvedValue(undefined) };
  const servicio = new UsuarioService(
    negocios,
    usuarios,
    dataSource,
    permisos,
    {} as unknown as PersonaService,
    claves as unknown as UsuarioClaveService,
    bitacora as unknown as BitacoraService,
  );
  return { servicio, usuarios, dataSource, claves, bitacora };
}

describe('UsuarioService: sobre quién se puede actuar', () => {
  it('un usuario de otro negocio (o inexistente) es 404', async () => {
    const { servicio } = armar({ usuario: null });
    await expect(servicio.desbloquear(2, editor)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('un usuario inactivo es 404 para las acciones', async () => {
    const { servicio } = armar({ usuario: objetivo({ idEstado: 0 }) });
    await expect(servicio.desactivar(2, editor)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('nadie actúa sobre su propio usuario (409)', async () => {
    const { servicio, claves } = armar({ usuario: objetivo({ idUsuario: 1 }) });
    await expect(
      servicio.restablecerClave(1, { claveTemporal: 'clave-larga-1' }, editor),
    ).rejects.toThrow(ConflictException);
    expect(claves.restablecer).not.toHaveBeenCalled();
  });

  it('el Dueño (rol fijo) no se toca (409)', async () => {
    const dueno = objetivo({
      idRolUsuario: 40,
      rol: {
        idRolUsuario: 40,
        nombre: 'Dueño',
        esFijo: true,
      } as Usuario['rol'],
    });
    const { servicio, usuarios } = armar({ usuario: dueno });
    await expect(servicio.desactivar(2, editor)).rejects.toThrow(
      ConflictException,
    );
    expect(usuarios.update).not.toHaveBeenCalled();
  });

  it('un usuario de un rol con permisos que el editor no tiene: 403 con la lista, y no se actúa', async () => {
    const gerente = objetivo({
      idRolUsuario: 30,
      rol: {
        idRolUsuario: 30,
        nombre: 'Gerente',
        esFijo: false,
      } as Usuario['rol'],
    });
    const { servicio, claves } = armar({ usuario: gerente });
    const error = await servicio
      .restablecerClave(2, { claveTemporal: 'clave-larga-1' }, editor)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).message).toContain(
      'productos.ver_costos',
    );
    expect(claves.restablecer).not.toHaveBeenCalled();
  });

  it('un usuario de un rol que el editor cubre sí se gestiona', async () => {
    const { servicio, claves, bitacora } = armar();
    await servicio.restablecerClave(
      2,
      { claveTemporal: 'clave-larga-1' },
      editor,
    );
    expect(claves.restablecer).toHaveBeenCalledWith(
      expect.objectContaining({ idUsuario: 2 }),
      'clave-larga-1',
      editor,
    );
    await servicio.desbloquear(2, editor);
    expect(claves.desbloquear).toHaveBeenCalled();
    await servicio.desactivar(2, editor);
    expect(bitacora.registrar).toHaveBeenCalledWith(
      'USUARIO_DESACTIVADO',
      expect.objectContaining({ idUsuarioObjetivo: 2 }),
    );
  });
});

describe('UsuarioService.crear', () => {
  const base = {
    usuario: 'beto@x.bo',
    claveTemporal: 'clave-larga-1',
    idRolUsuario: 20,
  };

  it('exige una persona existente o una nueva, no ambas ni ninguna', async () => {
    const { servicio } = armar();
    await expect(servicio.crear({ ...base }, editor)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      servicio.crear(
        { ...base, idPersona: 5, persona: { nombre: 'Ana' } },
        editor,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza una clave temporal corta', async () => {
    const { servicio } = armar();
    await expect(
      servicio.crear({ ...base, idPersona: 5, claveTemporal: 'corta' }, editor),
    ).rejects.toThrow(BadRequestException);
  });

  it('no asigna el rol fijo (409)', async () => {
    const { servicio, dataSource } = armar();
    await expect(
      servicio.crear({ ...base, idPersona: 5, idRolUsuario: 40 }, editor),
    ).rejects.toThrow(ConflictException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('no asigna un rol con más permisos que el propio (403)', async () => {
    const { servicio, dataSource } = armar();
    await expect(
      servicio.crear({ ...base, idPersona: 5, idRolUsuario: 30 }, editor),
    ).rejects.toThrow(ForbiddenException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('un rol de otro negocio es 404', async () => {
    const { servicio } = armar();
    await expect(
      servicio.crear({ ...base, idPersona: 5, idRolUsuario: 99 }, editor),
    ).rejects.toThrow(NotFoundException);
  });

  it('un login tomado responde el mensaje genérico (409)', async () => {
    const { servicio } = armar({ loginTomado: true });
    const error = await servicio
      .crear({ ...base, idPersona: 5 }, editor)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).toBe(
      'Ese nombre de usuario no está disponible.',
    );
  });
});

describe('UsuarioService.actualizar', () => {
  it('sin cambios no escribe ni registra', async () => {
    const { servicio, dataSource, bitacora } = armar();
    await servicio.actualizar(2, {}, editor);
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(bitacora.registrar).not.toHaveBeenCalled();
  });

  it('no sube a un usuario a un rol que el editor no cubre (403)', async () => {
    const { servicio, dataSource } = armar();
    await expect(
      servicio.actualizar(2, { idRolUsuario: 30 }, editor),
    ).rejects.toThrow(ForbiddenException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('no asigna el rol fijo (409)', async () => {
    const { servicio } = armar();
    await expect(
      servicio.actualizar(2, { idRolUsuario: 40 }, editor),
    ).rejects.toThrow(ConflictException);
  });
});
