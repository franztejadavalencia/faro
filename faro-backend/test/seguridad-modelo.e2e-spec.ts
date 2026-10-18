import { randomBytes } from 'crypto';
import { ForbiddenException } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { RequestContextService } from '../src/common/services/request-context.service';
import { NegocioRepositoryFactory } from '../src/common/utils/negocio-repository.factory';
import { getPgErrorCode } from '../src/common/utils/error-message';
import { sembrarAdminPlataforma } from '../src/database/seeds/admin-plataforma.seed';
import { Negocio } from '../src/plataforma/entities/negocio.entity';
import { Bitacora } from '../src/seguridad/entities/bitacora.entity';
import { Persona } from '../src/seguridad/entities/persona.entity';
import { Usuario } from '../src/seguridad/entities/usuario.entity';
import { crearApp } from './utils/crear-app';
import { limpiarBase } from './utils/limpiar-base';

/** Modelo de seguridad de B3: bitácora inmutable, login único, CHECK y seed. */
describe('Modelo de seguridad (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await crearApp();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await limpiarBase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  const crearNegocio = (nombre: string) =>
    dataSource.getRepository(Negocio).save({ nombre });

  const crearPersona = (datos: Partial<Persona> = {}) =>
    dataSource.getRepository(Persona).save(
      dataSource.getRepository(Persona).create({
        idNegocio: null,
        tipo: 'NATURAL',
        nombre: 'Ana',
        paterno: null,
        materno: null,
        tipoDocumento: null,
        documento: null,
        ...datos,
      }),
    );

  const crearUsuario = (
    usuario: string,
    idPersona: number,
    datos: Partial<Usuario> = {},
  ) =>
    dataSource.getRepository(Usuario).save(
      dataSource.getRepository(Usuario).create({
        idNegocio: null,
        usuario,
        clave: 'hash-de-prueba',
        idPersona,
        ...datos,
      }),
    );

  const codigo = async (promesa: Promise<unknown>) => {
    try {
      await promesa;
    } catch (error) {
      return getPgErrorCode(error);
    }
    return undefined;
  };

  describe('bitacora de solo inserción', () => {
    it('admite INSERT y SELECT, y rechaza UPDATE y DELETE', async () => {
      const negocio = await crearNegocio('Tienda');
      const repo = dataSource.getRepository(Bitacora);
      const fila = await repo.save({
        idNegocio: negocio.idNegocio,
        idUsuario: null,
        evento: 'LOGIN_FALLIDO',
        detalle: { motivo: 'prueba' },
        ip: '127.0.0.1',
        userAgent: null,
        url: '/api/auth/login',
        metodo: 'POST',
      });
      expect(fila.idBitacora).toBeGreaterThan(0);
      expect(await repo.count()).toBe(1);

      await expect(
        dataSource.query(`UPDATE bitacora SET evento = 'OTRO'`),
      ).rejects.toThrow(/solo inserción/);
      await expect(dataSource.query(`DELETE FROM bitacora`)).rejects.toThrow(
        /solo inserción/,
      );
      expect(
        await codigo(dataSource.query(`UPDATE bitacora SET evento = 'OTRO'`)),
      ).toBe('23001');

      // También por el ORM.
      await expect(
        repo.update({ idBitacora: fila.idBitacora }, { evento: 'OTRO' }),
      ).rejects.toThrow(/solo inserción/);
      await expect(
        repo.delete({ idBitacora: fila.idBitacora }),
      ).rejects.toThrow(/solo inserción/);

      const [guardada] = await repo.find();
      expect(guardada.evento).toBe('LOGIN_FALLIDO');
    });
  });

  describe('login único en toda la plataforma (lower(usuario))', () => {
    it('rechaza un duplicado aunque cambien las mayúsculas y el negocio', async () => {
      const a = await crearNegocio('A');
      const b = await crearNegocio('B');
      const personaA = await crearPersona({ idNegocio: a.idNegocio });
      const personaB = await crearPersona({
        idNegocio: b.idNegocio,
        nombre: 'Beto',
      });
      await crearUsuario('Ana', personaA.idPersona, { idNegocio: a.idNegocio });

      expect(
        await codigo(
          crearUsuario('ana', personaB.idPersona, { idNegocio: b.idNegocio }),
        ),
      ).toBe('23505');
    });

    it('permite reutilizar el login si el anterior está dado de baja', async () => {
      const personaA = await crearPersona({ nombre: 'Ana' });
      const personaB = await crearPersona({ nombre: 'Beto' });
      const primero = await crearUsuario('ana', personaA.idPersona);
      await dataSource
        .getRepository(Usuario)
        .update({ idUsuario: primero.idUsuario }, { idEstado: 0 });

      await expect(
        crearUsuario('ANA', personaB.idPersona),
      ).resolves.toBeDefined();
    });

    it('una persona tiene un solo usuario activo', async () => {
      const persona = await crearPersona();
      await crearUsuario('ana', persona.idPersona);
      expect(await codigo(crearUsuario('ana2', persona.idPersona))).toBe(
        '23505',
      );
    });

    it('usuario.clave y totp_secreto no salen en una lectura normal', async () => {
      const persona = await crearPersona();
      await crearUsuario('ana', persona.idPersona, { totpSecreto: 'cifrado' });
      const usuario = await dataSource
        .getRepository(Usuario)
        .findOneByOrFail({ usuario: 'ana' });
      expect(usuario.clave).toBeUndefined();
      expect(usuario.totpSecreto).toBeUndefined();
      expect(usuario.idNegocio).toBeNull();
    });
  });

  describe('persona', () => {
    it('el documento es único dentro de un negocio, no entre negocios', async () => {
      const a = await crearNegocio('A');
      const b = await crearNegocio('B');
      const doc = { tipoDocumento: 'CI' as const, documento: '1234567' };
      await crearPersona({ idNegocio: a.idNegocio, ...doc });

      expect(
        await codigo(crearPersona({ idNegocio: a.idNegocio, ...doc })),
      ).toBe('23505');
      await expect(
        crearPersona({ idNegocio: b.idNegocio, ...doc }),
      ).resolves.toBeDefined();
    });

    it('varias personas sin documento no chocan entre sí', async () => {
      const a = await crearNegocio('A');
      await crearPersona({ idNegocio: a.idNegocio });
      await expect(
        crearPersona({ idNegocio: a.idNegocio, nombre: 'Otra' }),
      ).resolves.toBeDefined();
    });

    it.each([
      ['tipo desconocido', { tipo: 'OTRO' as never }],
      [
        'tipo de documento desconocido',
        { tipoDocumento: 'DNI' as never, documento: '1' },
      ],
      ['tipo de documento sin documento', { tipoDocumento: 'CI' as const }],
      ['documento sin tipo de documento', { documento: '1' }],
      [
        'apellido en una persona jurídica',
        { tipo: 'JURIDICA' as const, paterno: 'Pérez' },
      ],
    ])('rechaza (CHECK): %s', async (_caso, datos) => {
      expect(await codigo(crearPersona(datos))).toBe('23514');
    });

    it('una persona jurídica sin apellidos es válida', async () => {
      await expect(
        crearPersona({
          tipo: 'JURIDICA',
          nombre: 'Tienda Sol SRL',
          tipoDocumento: 'NIT',
          documento: '1020304050',
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('negocio', () => {
    it('nace ACTIVO y rechaza un estado desconocido', async () => {
      const negocio = await crearNegocio('Tienda');
      expect(negocio.estado).toBe('ACTIVO');
      expect(
        await codigo(dataSource.query(`UPDATE negocio SET estado = 'CERRADO'`)),
      ).toBe('23514');
    });
  });

  describe('aislamiento: filas de plataforma y de negocio', () => {
    const ejecutar = <T>(idNegocio: number | null, fn: () => Promise<T>) =>
      app
        .get(RequestContextService)
        .ejecutarConContexto({ idUsuario: 1, idNegocio }, fn);

    it('NegocioRepository<Usuario> con el contexto de A no devuelve al admin ni a los de B', async () => {
      const a = await crearNegocio('A');
      const b = await crearNegocio('B');
      const admin = await crearPersona({ nombre: 'Admin' });
      await crearUsuario('admin', admin.idPersona);
      const pa = await crearPersona({ idNegocio: a.idNegocio, nombre: 'Ana' });
      const pb = await crearPersona({ idNegocio: b.idNegocio, nombre: 'Beto' });
      await crearUsuario('ana', pa.idPersona, { idNegocio: a.idNegocio });
      await crearUsuario('beto', pb.idPersona, { idNegocio: b.idNegocio });

      const fabrica = app.get(NegocioRepositoryFactory);
      const vistos = await ejecutar(a.idNegocio, () =>
        fabrica.para(Usuario).find(),
      );
      expect(vistos.map((u) => u.usuario)).toEqual(['ana']);
    });

    it('sin idNegocio en el contexto (admin de plataforma) lanza 403', async () => {
      const fabrica = app.get(NegocioRepositoryFactory);
      // NegocioRepository lanza en forma síncrona; un servicio async lo ve como rechazo.
      await expect(
        ejecutar(null, async () => fabrica.para(Usuario).find()),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        (async () => fabrica.para(Persona).find())(),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('un contexto con negocio no puede crear una persona de plataforma', async () => {
      const a = await crearNegocio('A');
      const persona = await ejecutar(a.idNegocio, () =>
        crearPersona({ idNegocio: null, nombre: 'Intento' }),
      );
      expect(persona.idNegocio).toBe(a.idNegocio);
    });
  });

  describe('seed del admin de plataforma', () => {
    const datos = () => ({
      usuario: 'admin',
      clave: randomBytes(12).toString('hex'),
      nombre: 'Administrador',
      debeCambiarClave: false,
    });

    it('crea persona y usuario sin negocio, con la clave hasheada', async () => {
      const d = datos();
      expect(await sembrarAdminPlataforma(dataSource, d)).toBe('creado');

      const admin = await dataSource
        .getRepository(Usuario)
        .createQueryBuilder('u')
        .addSelect('u.clave')
        .where('u.usuario = :usuario', { usuario: 'admin' })
        .getOneOrFail();
      expect(admin.idNegocio).toBeNull();
      expect(admin.debeCambiarClave).toBe(false);
      expect(admin.totpActivo).toBe(false);
      expect(admin.clave).not.toBe(d.clave);
      expect(await bcrypt.compare(d.clave, admin.clave)).toBe(true);

      const persona = await dataSource
        .getRepository(Persona)
        .findOneByOrFail({ idPersona: admin.idPersona });
      expect(persona.idNegocio).toBeNull();
      expect(persona.nombre).toBe('Administrador');
    });

    it('es idempotente: no duplica ni pisa la clave', async () => {
      const d = datos();
      await sembrarAdminPlataforma(dataSource, d);
      const otra = {
        ...d,
        usuario: 'ADMIN',
        clave: randomBytes(12).toString('hex'),
      };
      expect(await sembrarAdminPlataforma(dataSource, otra)).toBe('existente');

      expect(await dataSource.getRepository(Usuario).count()).toBe(1);
      expect(await dataSource.getRepository(Persona).count()).toBe(1);
      const admin = await dataSource
        .getRepository(Usuario)
        .createQueryBuilder('u')
        .addSelect('u.clave')
        .getOneOrFail();
      expect(await bcrypt.compare(d.clave, admin.clave)).toBe(true);
    });

    it('en producción nace con debe_cambiar_clave = true', async () => {
      await sembrarAdminPlataforma(dataSource, {
        ...datos(),
        debeCambiarClave: true,
      });
      const admin = await dataSource
        .getRepository(Usuario)
        .findOneByOrFail({ usuario: 'admin' });
      expect(admin.debeCambiarClave).toBe(true);
    });

    it('rechaza una clave corta o de más de 72 bytes sin crear nada', async () => {
      await expect(
        sembrarAdminPlataforma(dataSource, { ...datos(), clave: 'corta' }),
      ).rejects.toThrow(/ADMIN_CLAVE inválida/);
      await expect(
        sembrarAdminPlataforma(dataSource, {
          ...datos(),
          clave: 'ñ'.repeat(40),
        }),
      ).rejects.toThrow(/72 bytes/);
      expect(await dataSource.getRepository(Usuario).count()).toBe(0);
      expect(await dataSource.getRepository(Persona).count()).toBe(0);
    });
  });
});
