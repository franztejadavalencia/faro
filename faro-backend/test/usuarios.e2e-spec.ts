import { NestExpressApplication } from '@nestjs/platform-express';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { Negocio } from '../src/plataforma/entities/negocio.entity';
import { Persona } from '../src/seguridad/entities/persona.entity';
import { Usuario } from '../src/seguridad/entities/usuario.entity';
import { crearApp } from './utils/crear-app';
import { limpiarBase } from './utils/limpiar-base';
import {
  crearRolConPermisos,
  crearUsuarioConPermisos,
} from './utils/roles-de-prueba';
import {
  crearNegocioDePrueba,
  crearUsuarioDePrueba,
  rolDeNegocio,
  UsuarioDePrueba,
} from './utils/usuarios-de-prueba';

const CLAVE_TEMPORAL = 'temporal-clave-1';

interface FilaBitacora {
  id_usuario: number | null;
  id_negocio: number | null;
  detalle: Record<string, unknown> | null;
}

/** Usuarios del negocio (B7): alta, restablecer, desbloquear, baja, aislamiento y jerarquía. */
describe('Usuarios del negocio (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let negocioA: Negocio;
  let negocioB: Negocio;
  let duenoA: UsuarioDePrueba;
  let duenoB: UsuarioDePrueba;
  let tokenDuenoA: string;
  let tokenDuenoB: string;
  let rolEmpleadoA: number;
  let rolDuenoA: number;
  let secuencia = 0;

  const http = () => request(app.getHttpServer());
  const en = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = (usuario: string, clave: string) =>
    http().post('/api/auth/login').send({ usuario, clave });
  const tokenDe = async (u: UsuarioDePrueba): Promise<string> =>
    (await login(u.usuario, u.clave).expect(200)).body.token as string;
  const sesion = (token: string) =>
    http().get('/api/auth/sesion').set(en(token));

  const filaUsuario = (idUsuario: number) =>
    dataSource.getRepository(Usuario).findOneByOrFail({ idUsuario });
  const bitacora = (evento: string, idObjetivo: number) =>
    dataSource.query<FilaBitacora[]>(
      `SELECT id_usuario, id_negocio, detalle FROM bitacora
       WHERE evento = $1 AND (detalle->>'idUsuarioObjetivo')::int = $2
       ORDER BY id_bitacora`,
      [evento, idObjetivo],
    );
  const crearPersona = async (
    negocio: Negocio,
    nombre = 'Persona',
  ): Promise<Persona> => {
    secuencia += 1;
    const personas = dataSource.getRepository(Persona);
    return personas.save(
      personas.create({
        idNegocio: negocio.idNegocio,
        tipo: 'NATURAL',
        nombre: `${nombre} ${secuencia}`,
        paterno: null,
        materno: null,
        tipoDocumento: null,
        documento: null,
        correo: null,
        telefono: null,
      }),
    );
  };
  const nuevoLogin = () => {
    secuencia += 1;
    return `nuevo${secuencia}@a.bo`;
  };
  const altaCon = (token: string, cuerpo: Record<string, unknown>) =>
    http().post('/api/usuarios').set(en(token)).send(cuerpo);

  beforeAll(async () => {
    app = await crearApp();
    dataSource = app.get(DataSource);
    await limpiarBase(dataSource);
    negocioA = await crearNegocioDePrueba(dataSource, 'Tienda A');
    negocioB = await crearNegocioDePrueba(dataSource, 'Tienda B');
    duenoA = await crearUsuarioDePrueba(dataSource, { negocio: negocioA });
    duenoB = await crearUsuarioDePrueba(dataSource, { negocio: negocioB });
    rolEmpleadoA = await rolDeNegocio(
      dataSource,
      negocioA.idNegocio,
      'EMPLEADO',
    );
    rolDuenoA = await rolDeNegocio(dataSource, negocioA.idNegocio, 'DUENO');
    tokenDuenoA = await tokenDe(duenoA);
    tokenDuenoB = await tokenDe(duenoB);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('alta', () => {
    it('con persona nueva: crea la persona y el usuario, sin exponer la clave', async () => {
      const usuario = nuevoLogin();
      const { body } = await altaCon(tokenDuenoA, {
        persona: {
          nombre: '  Beto ',
          paterno: 'Ríos',
          tipoDocumento: 'CI',
          documento: '1234567',
          correo: 'beto@a.bo',
        },
        usuario,
        claveTemporal: CLAVE_TEMPORAL,
        idRolUsuario: rolEmpleadoA,
      }).expect(201);

      expect(body).toMatchObject({
        usuario,
        nombre: 'Beto Ríos',
        activo: true,
        bloqueado: false,
        debeCambiarClave: true,
        totpActivo: false,
        rol: { nombre: 'Empleado', esFijo: false },
        persona: { documento: '1234567', correo: 'beto@a.bo' },
      });
      expect(JSON.stringify(body)).not.toMatch(
        /"clave"|\$2b\$|totpSecreto|"secreto"/,
      );

      const persona = await dataSource
        .getRepository(Persona)
        .findOneByOrFail({ idPersona: body.persona.idPersona });
      expect(persona).toMatchObject({
        idNegocio: negocioA.idNegocio,
        tipo: 'NATURAL',
        nombre: 'Beto',
      });
      const fila = await dataSource
        .getRepository(Usuario)
        .createQueryBuilder('u')
        .addSelect('u.clave')
        .where('u.idUsuario = :id', { id: body.idUsuario })
        .getOneOrFail();
      expect(fila.idNegocio).toBe(negocioA.idNegocio);
      expect(fila.usuarioRegistro).toBe(duenoA.idUsuario);
      expect(await bcrypt.compare(CLAVE_TEMPORAL, fila.clave)).toBe(true);

      const [evento] = await bitacora('USUARIO_CREADO', body.idUsuario);
      expect(evento.id_usuario).toBe(duenoA.idUsuario);
      expect(evento.id_negocio).toBe(negocioA.idNegocio);
      expect(evento.detalle).toMatchObject({
        rol: 'Empleado',
        personaNueva: true,
      });
      expect(JSON.stringify(evento.detalle)).not.toContain(CLAVE_TEMPORAL);
    });

    it('con una persona existente', async () => {
      const persona = await crearPersona(negocioA, 'Carla');
      const { body } = await altaCon(tokenDuenoA, {
        idPersona: persona.idPersona,
        usuario: nuevoLogin(),
        claveTemporal: CLAVE_TEMPORAL,
        idRolUsuario: rolEmpleadoA,
      }).expect(201);
      expect(body.persona.idPersona).toBe(persona.idPersona);
      const [evento] = await bitacora('USUARIO_CREADO', body.idUsuario);
      expect(evento.detalle).toMatchObject({ personaNueva: false });
    });

    it('el empleado nuevo entra, pero solo puede cambiar la clave hasta que lo haga', async () => {
      const usuario = nuevoLogin();
      const persona = await crearPersona(negocioA);
      await altaCon(tokenDuenoA, {
        idPersona: persona.idPersona,
        usuario,
        claveTemporal: CLAVE_TEMPORAL,
        idRolUsuario: rolEmpleadoA,
      }).expect(201);

      const entrada = await login(usuario, CLAVE_TEMPORAL).expect(200);
      expect(entrada.body.estado).toBe('OK');
      expect(entrada.body.usuario.debeCambiarClave).toBe(true);
      expect(entrada.body.usuario.rol).toBe('Empleado');
      await sesion(entrada.body.token).expect(403);

      const cambio = await http()
        .post('/api/auth/cambiar-clave')
        .set(en(entrada.body.token))
        .send({ claveActual: CLAVE_TEMPORAL, claveNueva: 'clave-definitiva-9' })
        .expect(200);
      await sesion(cambio.body.token).expect(200);
    });

    it('rechaza lo que no corresponde', async () => {
      const ocupada = await crearUsuarioDePrueba(dataSource, {
        negocio: negocioA,
        rol: 'EMPLEADO',
      });
      const persona = await crearPersona(negocioA);
      const base = {
        usuario: nuevoLogin(),
        claveTemporal: CLAVE_TEMPORAL,
        idRolUsuario: rolEmpleadoA,
      };

      // persona e idPersona a la vez, o ninguna
      await altaCon(tokenDuenoA, {
        ...base,
        idPersona: persona.idPersona,
        persona: { nombre: 'X' },
      }).expect(400);
      await altaCon(tokenDuenoA, base).expect(400);
      // clave temporal corta
      await altaCon(tokenDuenoA, {
        ...base,
        idPersona: persona.idPersona,
        claveTemporal: 'corta',
      }).expect(400);
      // persona que ya tiene un usuario activo
      const personaOcupada = await filaUsuario(ocupada.idUsuario);
      await altaCon(tokenDuenoA, {
        ...base,
        idPersona: personaOcupada.idPersona,
      }).expect(409);
      // el rol Dueño no se asigna a nadie
      await altaCon(tokenDuenoA, {
        ...base,
        idPersona: persona.idPersona,
        idRolUsuario: rolDuenoA,
      }).expect(409);
      // campos que no existen
      await altaCon(tokenDuenoA, {
        ...base,
        idPersona: persona.idPersona,
        idNegocio: negocioB.idNegocio,
      }).expect(400);
    });

    it('el login repetido (aun en otro negocio y con otras mayúsculas) da el mismo mensaje', async () => {
      const persona = await crearPersona(negocioA);
      const cuerpo = (usuario: string) => ({
        idPersona: persona.idPersona,
        usuario,
        claveTemporal: CLAVE_TEMPORAL,
        idRolUsuario: rolEmpleadoA,
      });
      const delMismoNegocio = await altaCon(
        tokenDuenoA,
        cuerpo(duenoA.usuario.toUpperCase()),
      ).expect(409);
      const deOtroNegocio = await altaCon(
        tokenDuenoA,
        cuerpo(duenoB.usuario),
      ).expect(409);
      expect(delMismoNegocio.body.message).toBe(
        'Ese nombre de usuario no está disponible.',
      );
      expect(deOtroNegocio.body.message).toBe(delMismoNegocio.body.message);
    });

    it('un documento repetido en el negocio se rechaza; en otro negocio es otra persona', async () => {
      const persona = (documento: string) => ({
        nombre: 'Doc',
        tipoDocumento: 'CI',
        documento,
      });
      const alta = (token: string, rol: number, documento: string) =>
        altaCon(token, {
          persona: persona(documento),
          usuario: nuevoLogin(),
          claveTemporal: CLAVE_TEMPORAL,
          idRolUsuario: rol,
        });
      await alta(tokenDuenoA, rolEmpleadoA, '777001').expect(201);
      await alta(tokenDuenoA, rolEmpleadoA, '777001').expect(409);
      const rolEmpleadoB = await rolDeNegocio(
        dataSource,
        negocioB.idNegocio,
        'EMPLEADO',
      );
      await alta(tokenDuenoB, rolEmpleadoB, '777001').expect(201);
    });
  });

  describe('búsqueda de personas', () => {
    it('encuentra por nombre o documento, marca quién ya tiene usuario y trata los comodines como texto', async () => {
      const personaLibre = await dataSource.getRepository(Persona).save(
        dataSource.getRepository(Persona).create({
          idNegocio: negocioA.idNegocio,
          tipo: 'NATURAL',
          nombre: 'Zulema',
          paterno: 'Quispe',
          materno: null,
          tipoDocumento: 'CI',
          documento: '99887766',
          correo: null,
          telefono: null,
        }),
      );
      const porNombre = await http()
        .get('/api/personas?q=zulema qui')
        .set(en(tokenDuenoA))
        .expect(200);
      expect(porNombre.body).toEqual([
        expect.objectContaining({
          idPersona: personaLibre.idPersona,
          nombre: 'Zulema Quispe',
          tieneUsuario: false,
        }),
      ]);
      const porDocumento = await http()
        .get('/api/personas?q=9988776')
        .set(en(tokenDuenoA))
        .expect(200);
      expect(porDocumento.body).toHaveLength(1);

      const conUsuario = await http()
        .get(
          `/api/personas?q=${encodeURIComponent(duenoA.usuario.slice(0, 3))}`,
        )
        .set(en(tokenDuenoA))
        .expect(200);
      expect(Array.isArray(conUsuario.body)).toBe(true);

      // «%» y «_» son texto, no comodines
      for (const q of ['%%', '__', 'Z_lema']) {
        const { body } = await http()
          .get(`/api/personas?q=${encodeURIComponent(q)}`)
          .set(en(tokenDuenoA))
          .expect(200);
        expect(body).toEqual([]);
      }
      await http().get('/api/personas?q=z').set(en(tokenDuenoA)).expect(400);
      await http().get('/api/personas').set(en(tokenDuenoA)).expect(400);
    });

    it('marca con tieneUsuario a quien ya lo tiene', async () => {
      const persona = await crearPersona(negocioA, 'Wilma');
      await altaCon(tokenDuenoA, {
        idPersona: persona.idPersona,
        usuario: nuevoLogin(),
        claveTemporal: CLAVE_TEMPORAL,
        idRolUsuario: rolEmpleadoA,
      }).expect(201);
      const { body } = await http()
        .get('/api/personas?q=wilma')
        .set(en(tokenDuenoA))
        .expect(200);
      expect(body[0]).toMatchObject({
        idPersona: persona.idPersona,
        tieneUsuario: true,
      });
    });
  });

  describe('restablecer clave, desbloquear y desactivar', () => {
    it('restablecer deja debe_cambiar_clave, cierra sus sesiones y la clave nueva sirve', async () => {
      const u = await crearUsuarioConPermisos(dataSource, negocioA, [
        'pos.ver',
      ]);
      const tokenViejo = await tokenDe(u);
      await sesion(tokenViejo).expect(200);
      const antes = await filaUsuario(u.idUsuario);

      await http()
        .post(`/api/usuarios/${u.idUsuario}/restablecer-clave`)
        .set(en(tokenDuenoA))
        .send({ claveTemporal: 'temporal-nueva-1' })
        .expect(204);

      await sesion(tokenViejo).expect(401);
      const despues = await filaUsuario(u.idUsuario);
      expect(despues.debeCambiarClave).toBe(true);
      expect(despues.versionSesion).toBe(antes.versionSesion + 1);
      expect(despues.usuarioModificacion).toBe(duenoA.idUsuario);
      await login(u.usuario, u.clave).expect(401);
      const entrada = await login(u.usuario, 'temporal-nueva-1').expect(200);
      expect(entrada.body.usuario.debeCambiarClave).toBe(true);

      const [evento] = await bitacora('CLAVE_RESTABLECIDA', u.idUsuario);
      expect(evento.id_usuario).toBe(duenoA.idUsuario);
      expect(evento.id_negocio).toBe(negocioA.idNegocio);
      expect(evento.detalle).toEqual({
        idUsuarioObjetivo: u.idUsuario,
        actor: 'NEGOCIO',
      });
    });

    it('restablecer también levanta el bloqueo y rechaza una clave corta', async () => {
      const u = await crearUsuarioConPermisos(dataSource, negocioA, [
        'pos.ver',
      ]);
      await dataSource.query(
        `UPDATE usuario SET bloqueado_hasta = now() + interval '10 minutes' WHERE id_usuario = $1`,
        [u.idUsuario],
      );
      const url = `/api/usuarios/${u.idUsuario}/restablecer-clave`;
      await http()
        .post(url)
        .set(en(tokenDuenoA))
        .send({ claveTemporal: 'corta' })
        .expect(400);
      expect((await filaUsuario(u.idUsuario)).bloqueadoHasta).not.toBeNull();

      await http()
        .post(url)
        .set(en(tokenDuenoA))
        .send({ claveTemporal: 'temporal-nueva-2' })
        .expect(204);
      expect((await filaUsuario(u.idUsuario)).bloqueadoHasta).toBeNull();
    });

    it('desbloquear levanta el bloqueo sin cortar las sesiones abiertas', async () => {
      const u = await crearUsuarioConPermisos(dataSource, negocioA, [
        'pos.ver',
      ]);
      const token = await tokenDe(u);
      const antes = await filaUsuario(u.idUsuario);
      await dataSource.query(
        `UPDATE usuario SET bloqueado_hasta = now() + interval '10 minutes' WHERE id_usuario = $1`,
        [u.idUsuario],
      );
      await login(u.usuario, u.clave).expect(401);
      const listado = await http()
        .get('/api/usuarios')
        .set(en(tokenDuenoA))
        .expect(200);
      expect(
        listado.body.find(
          (x: { idUsuario: number }) => x.idUsuario === u.idUsuario,
        ).bloqueado,
      ).toBe(true);

      await http()
        .post(`/api/usuarios/${u.idUsuario}/desbloquear`)
        .set(en(tokenDuenoA))
        .expect(204);

      await login(u.usuario, u.clave).expect(200);
      await sesion(token).expect(200);
      const despues = await filaUsuario(u.idUsuario);
      expect(despues.versionSesion).toBe(antes.versionSesion);
      expect(despues.bloqueadoHasta).toBeNull();
      const [evento] = await bitacora('USUARIO_DESBLOQUEADO', u.idUsuario);
      expect(evento.id_usuario).toBe(duenoA.idUsuario);
    });

    it('desactivar: deja de entrar, su token muere y libera el login y la persona', async () => {
      const u = await crearUsuarioConPermisos(dataSource, negocioA, [
        'pos.ver',
      ]);
      const token = await tokenDe(u);
      const idPersona = (await filaUsuario(u.idUsuario)).idPersona;

      await http()
        .delete(`/api/usuarios/${u.idUsuario}`)
        .set(en(tokenDuenoA))
        .expect(204);

      await login(u.usuario, u.clave).expect(401);
      await sesion(token).expect(401);
      expect((await filaUsuario(u.idUsuario)).idEstado).toBe(0);
      expect((await bitacora('USUARIO_DESACTIVADO', u.idUsuario)).length).toBe(
        1,
      );

      const ids = async (estado?: string) =>
        (
          (
            await http()
              .get(`/api/usuarios${estado ? `?estado=${estado}` : ''}`)
              .set(en(tokenDuenoA))
              .expect(200)
          ).body as { idUsuario: number }[]
        ).map((x) => x.idUsuario);
      expect(await ids()).not.toContain(u.idUsuario);
      expect(await ids('INACTIVOS')).toContain(u.idUsuario);
      expect(await ids('TODOS')).toContain(u.idUsuario);
      await http()
        .get('/api/usuarios?estado=OTRO')
        .set(en(tokenDuenoA))
        .expect(400);

      // El login y la persona quedaron libres para un alta nueva.
      await altaCon(tokenDuenoA, {
        idPersona,
        usuario: u.usuario,
        claveTemporal: CLAVE_TEMPORAL,
        idRolUsuario: rolEmpleadoA,
      }).expect(201);
      // Un usuario desactivado ya no admite acciones.
      await http()
        .post(`/api/usuarios/${u.idUsuario}/desbloquear`)
        .set(en(tokenDuenoA))
        .expect(404);
    });

    it('actualizar cambia el rol y el contacto, no el login ni el documento', async () => {
      const persona = await dataSource.getRepository(Persona).save(
        dataSource.getRepository(Persona).create({
          idNegocio: negocioA.idNegocio,
          tipo: 'NATURAL',
          nombre: 'Edgar',
          paterno: null,
          materno: null,
          tipoDocumento: 'CI',
          documento: '555111',
          correo: null,
          telefono: null,
        }),
      );
      const creado = await altaCon(tokenDuenoA, {
        idPersona: persona.idPersona,
        usuario: nuevoLogin(),
        claveTemporal: CLAVE_TEMPORAL,
        idRolUsuario: rolEmpleadoA,
      }).expect(201);
      const idRolNuevo = await crearRolConPermisos(dataSource, negocioA, [
        'pos.ver',
      ]);
      const url = `/api/usuarios/${creado.body.idUsuario}`;

      const { body } = await http()
        .patch(url)
        .set(en(tokenDuenoA))
        .send({
          idRolUsuario: idRolNuevo,
          persona: { telefono: '70112233', paterno: 'Vega' },
        })
        .expect(200);
      expect(body.rol.idRolUsuario).toBe(idRolNuevo);
      expect(body.persona).toMatchObject({
        telefono: '70112233',
        paterno: 'Vega',
        documento: '555111',
      });
      expect(body.usuario).toBe(creado.body.usuario);
      const [evento] = await bitacora('USUARIO_ACTUALIZADO', body.idUsuario);
      expect(evento.detalle).toMatchObject({
        rolAnterior: 'Empleado',
        contacto: true,
      });

      // Ni el documento, ni el login, ni la persona se cambian por aquí.
      await http()
        .patch(url)
        .set(en(tokenDuenoA))
        .send({ persona: { documento: '1' } })
        .expect(400);
      await http()
        .patch(url)
        .set(en(tokenDuenoA))
        .send({ usuario: 'otro@a.bo' })
        .expect(400);
      await http()
        .patch(url)
        .set(en(tokenDuenoA))
        .send({ persona: { nombre: '   ' } })
        .expect(400);
    });
  });

  describe('aislamiento entre negocios (decisión 30)', () => {
    it('el dueño de B no lista, lee ni modifica los usuarios de A, ni referencia sus personas o roles', async () => {
      const x = await crearUsuarioConPermisos(dataSource, negocioA, [
        'pos.ver',
      ]);
      const antes = await filaUsuario(x.idUsuario);
      const url = `/api/usuarios/${x.idUsuario}`;

      const lista = await http()
        .get('/api/usuarios?estado=TODOS')
        .set(en(tokenDuenoB))
        .expect(200);
      const idsB = (lista.body as { idUsuario: number }[]).map(
        (u) => u.idUsuario,
      );
      const idsDeA = (
        await dataSource.query<{ id_usuario: number }[]>(
          'SELECT id_usuario FROM usuario WHERE id_negocio = $1',
          [negocioA.idNegocio],
        )
      ).map((f) => f.id_usuario);
      expect(idsB).toContain(duenoB.idUsuario);
      expect(idsB).not.toContain(x.idUsuario);
      expect(idsB.filter((id) => idsDeA.includes(id))).toEqual([]);

      await http().get(url).set(en(tokenDuenoB)).expect(404);
      await http()
        .patch(url)
        .set(en(tokenDuenoB))
        .send({ persona: { nombre: 'Robado' } })
        .expect(404);
      await http()
        .post(`${url}/restablecer-clave`)
        .set(en(tokenDuenoB))
        .send({ claveTemporal: 'temporal-ajena-1' })
        .expect(404);
      await http().post(`${url}/desbloquear`).set(en(tokenDuenoB)).expect(404);
      await http().delete(url).set(en(tokenDuenoB)).expect(404);

      const despues = await filaUsuario(x.idUsuario);
      expect(despues.idEstado).toBe(1);
      expect(despues.versionSesion).toBe(antes.versionSesion);
      expect(despues.debeCambiarClave).toBe(antes.debeCambiarClave);
      await login(x.usuario, x.clave).expect(200);

      // Una persona y un rol de A no se pueden referenciar desde B.
      const personaDeA = await crearPersona(negocioA, 'DeA');
      const rolEmpleadoB = await rolDeNegocio(
        dataSource,
        negocioB.idNegocio,
        'EMPLEADO',
      );
      await altaCon(tokenDuenoB, {
        idPersona: personaDeA.idPersona,
        usuario: nuevoLogin(),
        claveTemporal: CLAVE_TEMPORAL,
        idRolUsuario: rolEmpleadoB,
      }).expect(404);
      const nuevaDeB = await crearPersona(negocioB, 'DeB');
      await altaCon(tokenDuenoB, {
        idPersona: nuevaDeB.idPersona,
        usuario: nuevoLogin(),
        claveTemporal: CLAVE_TEMPORAL,
        idRolUsuario: rolEmpleadoA,
      }).expect(404);
      await http()
        .patch(`/api/usuarios/${duenoB.idUsuario}`)
        .set(en(tokenDuenoB))
        .send({ idRolUsuario: rolEmpleadoA })
        .expect(409);

      // La búsqueda de personas tampoco cruza negocios.
      const busqueda = await http()
        .get(`/api/personas?q=${encodeURIComponent(personaDeA.nombre)}`)
        .set(en(tokenDuenoB))
        .expect(200);
      expect(busqueda.body).toEqual([]);
    });
  });

  describe('jerarquía de roles (decisión 99 llevada a usuarios)', () => {
    let rolBajo: number;
    let rolAlto: number;
    let rolGestor: number;
    let gestor: UsuarioDePrueba;
    let tokenGestor: string;
    let compañero: UsuarioDePrueba;
    let bajo: UsuarioDePrueba;
    let alto: UsuarioDePrueba;

    beforeAll(async () => {
      rolBajo = await crearRolConPermisos(dataSource, negocioA, ['pos.ver']);
      rolAlto = await crearRolConPermisos(dataSource, negocioA, [
        'pos.ver',
        'productos.ver_costos',
      ]);
      rolGestor = await crearRolConPermisos(dataSource, negocioA, [
        'pos.ver',
        'usuarios.ver',
        'usuarios.crear',
        'usuarios.editar',
        'usuarios.eliminar',
      ]);
      const con = (idRolUsuario: number) =>
        crearUsuarioConPermisos(dataSource, negocioA, [], { idRolUsuario });
      gestor = await con(rolGestor);
      compañero = await con(rolGestor);
      bajo = await con(rolBajo);
      alto = await con(rolAlto);
      tokenGestor = await tokenDe(gestor);
    });

    const como = (metodo: 'post' | 'patch' | 'delete', url: string) =>
      http()[metodo](url).set(en(tokenGestor));

    it('no asigna ni crea con un rol con más permisos que el suyo, y dice cuáles le faltan', async () => {
      const persona = await crearPersona(negocioA);
      const alta = await altaCon(tokenGestor, {
        idPersona: persona.idPersona,
        usuario: nuevoLogin(),
        claveTemporal: CLAVE_TEMPORAL,
        idRolUsuario: rolAlto,
      }).expect(403);
      expect(alta.body.message).toContain('productos.ver_costos');

      const cambio = await como('patch', `/api/usuarios/${bajo.idUsuario}`)
        .send({ idRolUsuario: rolAlto })
        .expect(403);
      expect(cambio.body.message).toContain('productos.ver_costos');
      expect((await filaUsuario(bajo.idUsuario)).idRolUsuario).toBe(rolBajo);
    });

    it('no se asigna a sí mismo un rol mayor ni cambia su propio usuario', async () => {
      const propio = `/api/usuarios/${gestor.idUsuario}`;
      await como('patch', propio).send({ idRolUsuario: rolAlto }).expect(409);
      await como('patch', propio).send({ idRolUsuario: rolBajo }).expect(409);
      await como('post', `${propio}/restablecer-clave`)
        .send({ claveTemporal: 'temporal-propia-1' })
        .expect(409);
      await como('post', `${propio}/desbloquear`).expect(409);
      await como('delete', propio).expect(409);
      expect((await filaUsuario(gestor.idUsuario)).idRolUsuario).toBe(
        rolGestor,
      );
    });

    it('no toca a un usuario de un rol superior: ni su clave, ni su bloqueo, ni su baja', async () => {
      const url = `/api/usuarios/${alto.idUsuario}`;
      const antes = await filaUsuario(alto.idUsuario);
      const reset = await como('post', `${url}/restablecer-clave`)
        .send({ claveTemporal: 'temporal-ajena-2' })
        .expect(403);
      expect(reset.body.message).toContain('productos.ver_costos');
      await como('post', `${url}/desbloquear`).expect(403);
      await como('delete', url).expect(403);
      await como('patch', url).send({ idRolUsuario: rolBajo }).expect(403);

      const despues = await filaUsuario(alto.idUsuario);
      expect(despues.idEstado).toBe(1);
      expect(despues.idRolUsuario).toBe(rolAlto);
      expect(despues.versionSesion).toBe(antes.versionSesion);
      // La clave del superior sigue valiendo: no hubo toma de cuenta.
      await login(alto.usuario, alto.clave).expect(200);
    });

    it('no toca al Dueño ni asigna el rol Dueño', async () => {
      const dueno = `/api/usuarios/${duenoA.idUsuario}`;
      await como('post', `${dueno}/restablecer-clave`)
        .send({ claveTemporal: 'temporal-ajena-3' })
        .expect(409);
      await como('delete', dueno).expect(409);
      await como('patch', `/api/usuarios/${bajo.idUsuario}`)
        .send({ idRolUsuario: rolDuenoA })
        .expect(409);
      // Ni siquiera el propio Dueño.
      await http()
        .patch(`/api/usuarios/${bajo.idUsuario}`)
        .set(en(tokenDuenoA))
        .send({ idRolUsuario: rolDuenoA })
        .expect(409);
      await login(duenoA.usuario, duenoA.clave).expect(200);
    });

    it('sí gestiona a quien su rol cubre, con el actor en la bitácora (aun a un par de su mismo rol)', async () => {
      await como('post', `/api/usuarios/${bajo.idUsuario}/restablecer-clave`)
        .send({ claveTemporal: 'temporal-bajo-1' })
        .expect(204);
      await como(
        'post',
        `/api/usuarios/${compañero.idUsuario}/restablecer-clave`,
      )
        .send({ claveTemporal: 'temporal-par-1' })
        .expect(204);

      // El hecho queda con su autor y la víctima lo nota: sus sesiones murieron.
      for (const objetivo of [bajo, compañero]) {
        const [evento] = await bitacora(
          'CLAVE_RESTABLECIDA',
          objetivo.idUsuario,
        );
        expect(evento.id_usuario).toBe(gestor.idUsuario);
        expect((await filaUsuario(objetivo.idUsuario)).debeCambiarClave).toBe(
          true,
        );
      }

      const persona = await crearPersona(negocioA);
      await altaCon(tokenGestor, {
        idPersona: persona.idPersona,
        usuario: nuevoLogin(),
        claveTemporal: CLAVE_TEMPORAL,
        idRolUsuario: rolBajo,
      }).expect(201);
    });
  });

  describe('sin el permiso de usuarios', () => {
    it('responde 403 en todas las rutas', async () => {
      const u = await crearUsuarioConPermisos(dataSource, negocioA, [
        'pos.ver',
      ]);
      const token = await tokenDe(u);
      const objetivo = `/api/usuarios/${duenoA.idUsuario}`;
      await http().get('/api/usuarios').set(en(token)).expect(403);
      await http().get(objetivo).set(en(token)).expect(403);
      await http().post('/api/usuarios').set(en(token)).send({}).expect(403);
      await http().patch(objetivo).set(en(token)).send({}).expect(403);
      await http()
        .post(`${objetivo}/restablecer-clave`)
        .set(en(token))
        .send({ claveTemporal: 'temporal-ajena-4' })
        .expect(403);
      await http().post(`${objetivo}/desbloquear`).set(en(token)).expect(403);
      await http().delete(objetivo).set(en(token)).expect(403);
      await http().get('/api/personas?q=ana').set(en(token)).expect(403);
    });

    it('con solo `usuarios.ver` lista, pero no crea ni modifica', async () => {
      const u = await crearUsuarioConPermisos(dataSource, negocioA, [
        'usuarios.ver',
      ]);
      const token = await tokenDe(u);
      await http().get('/api/usuarios').set(en(token)).expect(200);
      await http()
        .post(`/api/usuarios/${u.idUsuario}/desbloquear`)
        .set(en(token))
        .expect(403);
      await http().get('/api/personas?q=ana').set(en(token)).expect(403);
    });
  });
});
