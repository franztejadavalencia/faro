import { Controller, Get, Module, Post } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { otorgarARolesFijos } from '../src/database/utils/otorgar-a-roles-fijos';
import {
  GRUPOS_CATALOGO,
  MODULOS_CATALOGO,
  OPCIONES_CATALOGO,
  ROL_DUENO,
  ROL_EMPLEADO,
  ROL_PLATAFORMA,
} from '../src/seguridad/permiso/constants/catalogo';
import { MODULOS } from '../src/seguridad/permiso/constants/modulos';
import { OPCIONES } from '../src/seguridad/permiso/constants/opciones';
import { OmitirSinVerCostos } from '../src/seguridad/permiso/decorators/omitir-sin-ver-costos.decorator';
import { RequierePermiso } from '../src/seguridad/permiso/decorators/requiere-permiso.decorator';
import { RolUsuario } from '../src/seguridad/permiso/entities/rol-usuario.entity';
import { PermisoService } from '../src/seguridad/permiso/services/permiso.service';
import { Negocio } from '../src/plataforma/entities/negocio.entity';
import { crearApp } from './utils/crear-app';
import { limpiarBase } from './utils/limpiar-base';
import {
  crearNegocioDePrueba,
  crearUsuarioDePrueba,
  UsuarioDePrueba,
} from './utils/usuarios-de-prueba';

/** Rutas solo de prueba, protegidas por los guards globales reales. */
@Controller('prueba-permisos')
class PruebaPermisos {
  @Get('productos')
  @RequierePermiso(MODULOS.PRODUCTOS, OPCIONES.VER)
  ver() {
    return { ok: true };
  }

  @Post('productos')
  @RequierePermiso(MODULOS.PRODUCTOS, OPCIONES.CREAR)
  crear() {
    return { ok: true };
  }

  @Get('costos')
  @RequierePermiso(MODULOS.PRODUCTOS, OPCIONES.VER)
  @OmitirSinVerCostos(MODULOS.PRODUCTOS, ['costoUnitario', 'valor'])
  costos() {
    return {
      nombre: 'Leche',
      costoUnitario: '3.5000',
      valor: '10.00',
      lotes: [{ lote: 1, costoUnitario: '3.0000' }],
    };
  }

  /** Sin ninguna marca: el guard debe denegarla. */
  @Get('sin-marca')
  sinMarca() {
    return { ok: true };
  }
}

@Module({ controllers: [PruebaPermisos] })
class ModuloPruebaPermisos {}

interface FilaPar {
  modulo: string;
  opcion: string;
}

/** Permisos, menú, roles y omisión de costos (B6; decisiones 38, 44, 45, 49 y 99). */
describe('Permisos (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let negocioA: Negocio;
  let negocioB: Negocio;
  let duenoA: UsuarioDePrueba;
  let duenoB: UsuarioDePrueba;
  let tokenDuenoA: string;
  let tokenDuenoB: string;
  let secuencia = 0;

  const http = () => request(app.getHttpServer());
  const en = (token: string) => ({ Authorization: `Bearer ${token}` });
  const loginDe = async (u: UsuarioDePrueba): Promise<string> =>
    (
      await http()
        .post('/api/auth/login')
        .send({ usuario: u.usuario, clave: u.clave })
        .expect(200)
    ).body.token as string;

  /** Rol propio del negocio con exactamente estos permisos (`modulo.opcion`). */
  const crearRol = async (
    negocio: Negocio,
    permisos: string[],
  ): Promise<number> => {
    secuencia += 1;
    const rol = await dataSource.getRepository(RolUsuario).save(
      dataSource.getRepository(RolUsuario).create({
        idNegocio: negocio.idNegocio,
        nombre: `Rol de prueba ${secuencia}`,
        descripcion: null,
        esFijo: false,
      }),
    );
    for (const permiso of permisos) {
      const [modulo, opcion] = permiso.split('.');
      const concedidos = await dataSource.query<unknown[]>(
        `INSERT INTO permiso_rol_usuario (id_rol_usuario, id_modulo_sistema, id_opcion_modulo_sistema, activo)
         SELECT $1, mo.id_modulo_sistema, mo.id_opcion_modulo_sistema, true
         FROM modulo_opcion_sistema mo
         JOIN modulo_sistema m ON m.id_modulo_sistema = mo.id_modulo_sistema
         JOIN opcion_modulo_sistema o ON o.id_opcion_modulo_sistema = mo.id_opcion_modulo_sistema
         WHERE m.codigo = $2 AND o.codigo = $3 RETURNING 1`,
        [rol.idRolUsuario, modulo, opcion],
      );
      expect(concedidos).toHaveLength(1);
    }
    return rol.idRolUsuario;
  };

  /** Usuario del negocio cuyo rol tiene solo estos permisos, ya con su token. */
  const conPermisos = async (negocio: Negocio, permisos: string[]) => {
    const idRol = await crearRol(negocio, permisos);
    const u = await crearUsuarioDePrueba(dataSource, {
      negocio,
      rol: 'EMPLEADO',
    });
    await dataSource.query(
      'UPDATE usuario SET id_rol_usuario = $1 WHERE id_usuario = $2',
      [idRol, u.idUsuario],
    );
    return { u, idRol, token: await loginDe(u) };
  };

  const rolesDe = async (token: string) =>
    (await http().get('/api/roles').set(en(token)).expect(200)).body as {
      idRolUsuario: number;
      nombre: string;
      esFijo: boolean;
    }[];
  const rolPorNombre = async (token: string, nombre: string) =>
    (await rolesDe(token)).find((r) => r.nombre === nombre)!;
  const activos = async (idRol: number): Promise<string[]> =>
    (
      await dataSource.query<FilaPar[]>(
        `SELECT m.codigo AS modulo, o.codigo AS opcion
         FROM permiso_rol_usuario p
         JOIN modulo_sistema m ON m.id_modulo_sistema = p.id_modulo_sistema
         JOIN opcion_modulo_sistema o ON o.id_opcion_modulo_sistema = p.id_opcion_modulo_sistema
         WHERE p.id_rol_usuario = $1 AND p.activo ORDER BY 1, 2`,
        [idRol],
      )
    ).map((f) => `${f.modulo}.${f.opcion}`);
  const permisosBody = (...pares: string[]) => ({
    permisos: pares.map((p) => {
      const [modulo, opcion] = p.split('.');
      return { modulo, opcion };
    }),
  });

  beforeAll(async () => {
    app = await crearApp([ModuloPruebaPermisos]);
    dataSource = app.get(DataSource);
    await limpiarBase(dataSource);
    negocioA = await crearNegocioDePrueba(dataSource, 'Tienda A');
    negocioB = await crearNegocioDePrueba(dataSource, 'Tienda B');
    duenoA = await crearUsuarioDePrueba(dataSource, { negocio: negocioA });
    duenoB = await crearUsuarioDePrueba(dataSource, { negocio: negocioB });
    tokenDuenoA = await loginDe(duenoA);
    tokenDuenoB = await loginDe(duenoB);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('catálogo sembrado por migración', () => {
    it('las constantes del código y las filas de la base coinciden, en las dos direcciones', async () => {
      const modulos = await dataSource.query<
        {
          codigo: string;
          tipo_modulo: string;
          ambito: string;
          route: string | null;
          grupo: string | null;
          orden: number;
        }[]
      >(
        `SELECT m.codigo, m.tipo_modulo, m.ambito, m.route, g.codigo AS grupo, m.orden
         FROM modulo_sistema m
         LEFT JOIN modulo_sistema g ON g.id_modulo_sistema = m.id_grupo_modulo_sistema`,
      );
      const hojas = modulos.filter((m) => m.tipo_modulo === 'MENU');
      expect(hojas.map((m) => m.codigo).sort()).toEqual(
        Object.values(MODULOS).sort(),
      );
      expect(hojas.map((m) => m.codigo).sort()).toEqual(
        MODULOS_CATALOGO.map((m) => m.codigo).sort(),
      );
      for (const esperado of MODULOS_CATALOGO) {
        const fila = hojas.find((m) => m.codigo === esperado.codigo)!;
        expect({
          ambito: fila.ambito,
          route: fila.route,
          grupo: fila.grupo,
          orden: fila.orden,
        }).toEqual({
          ambito: esperado.ambito,
          route: esperado.route,
          grupo: esperado.grupo,
          orden: esperado.orden,
        });
      }
      expect(
        modulos
          .filter((m) => m.tipo_modulo === 'GRUPO')
          .map((m) => m.codigo)
          .sort(),
      ).toEqual(GRUPOS_CATALOGO.map((g) => g.codigo).sort());

      const opciones = await dataSource.query<{ codigo: string }[]>(
        'SELECT codigo FROM opcion_modulo_sistema',
      );
      expect(opciones.map((o) => o.codigo).sort()).toEqual(
        Object.values(OPCIONES).sort(),
      );
      expect(opciones).toHaveLength(OPCIONES_CATALOGO.length);

      const pares = await dataSource.query<FilaPar[]>(
        `SELECT m.codigo AS modulo, o.codigo AS opcion
         FROM modulo_opcion_sistema mo
         JOIN modulo_sistema m ON m.id_modulo_sistema = mo.id_modulo_sistema
         JOIN opcion_modulo_sistema o ON o.id_opcion_modulo_sistema = mo.id_opcion_modulo_sistema`,
      );
      const delCodigo = MODULOS_CATALOGO.flatMap((m) =>
        m.opciones.map((o) => `${m.codigo}.${o}`),
      ).sort();
      expect(pares.map((p) => `${p.modulo}.${p.opcion}`).sort()).toEqual(
        delCodigo,
      );
    });

    it('todo rol fijo tiene todos los pares de su ámbito (y solo esos)', async () => {
      const filas = await dataSource.query<
        { id_rol_usuario: number; id_negocio: number | null; total: string }[]
      >(
        `SELECT r.id_rol_usuario, r.id_negocio,
                (SELECT count(*) FROM permiso_rol_usuario p
                  WHERE p.id_rol_usuario = r.id_rol_usuario AND p.activo) AS total
         FROM rol_usuario r WHERE r.es_fijo AND r.id_estado = 1`,
      );
      const pares = (ambito: string) =>
        MODULOS_CATALOGO.filter((m) => m.ambito === ambito).reduce(
          (n, m) => n + m.opciones.length,
          0,
        );
      expect(filas).toHaveLength(3); // Dueño de A, Dueño de B y el de plataforma
      for (const f of filas) {
        expect(Number(f.total)).toBe(
          pares(f.id_negocio === null ? 'PLATAFORMA' : 'NEGOCIO'),
        );
      }
    });

    it('otorgarARolesFijos reparte un módulo nuevo a los roles fijos de su ámbito', async () => {
      const runner = dataSource.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        const [{ id: idModulo }] = (await runner.query(
          `INSERT INTO modulo_sistema (codigo, nombre, descripcion, route, icono, orden, tipo_modulo, ambito)
           VALUES ('zz_prueba', 'ZZ', 'ZZ', '/zz', 'x', 99, 'MENU', 'NEGOCIO') RETURNING id_modulo_sistema AS id`,
        )) as { id: number }[];
        await runner.query(
          `INSERT INTO modulo_opcion_sistema SELECT $1, id_opcion_modulo_sistema
           FROM opcion_modulo_sistema WHERE codigo IN ('ver', 'crear')`,
          [idModulo],
        );
        // Solo los dos Dueño (2 opciones cada uno): el rol de plataforma es de otro ámbito.
        expect(await otorgarARolesFijos(runner, 'zz_prueba')).toBe(4);
        // Idempotente.
        expect(await otorgarARolesFijos(runner, 'zz_prueba')).toBe(4);
        await expect(otorgarARolesFijos(runner, 'no_existe')).rejects.toThrow(
          /no existe el módulo/,
        );
      } finally {
        // Se deshace todo: el catálogo no cambia entre suites.
        await runner.rollbackTransaction();
        await runner.release();
      }
      const quedan = await dataSource.query<unknown[]>(
        `SELECT 1 FROM modulo_sistema WHERE codigo = 'zz_prueba'`,
      );
      expect(quedan).toHaveLength(0);
    });
  });

  describe('menú y permisos de la sesión', () => {
    const nombres = (menu: { nombre: string }[]) => menu.map((m) => m.nombre);

    it('el Dueño ve todos los grupos de negocio y ninguno de plataforma', async () => {
      const { body } = await http()
        .post('/api/auth/login')
        .send({ usuario: duenoA.usuario, clave: duenoA.clave })
        .expect(200);
      expect(body.usuario.rol).toBe(ROL_DUENO);
      expect(nombres(body.menu)).toEqual([
        'Ventas',
        'Inventario',
        'Catálogo',
        'Gastos',
        'Contabilidad',
        'Cierre mensual',
        'Análisis',
        'Configuración',
        'Seguridad',
      ]);
      expect(body.permisos).toContainEqual({
        modulo: 'productos',
        opcion: 'ver_costos',
      });
      // Una hoja de nivel superior no trae `hijos`; un grupo sí, sin `route`.
      expect(body.menu[3]).toMatchObject({
        codigo: 'gastos',
        route: '/gastos',
      });
      expect(body.menu[3].hijos).toBeUndefined();
      expect(body.menu[0].route).toBeNull();
      expect(nombres(body.menu[0].hijos)).toEqual(['Punto de venta', 'Ventas']);
    });

    it('el Empleado solo ve lo que tiene con `ver`, y no tiene costos', async () => {
      const empleado = await crearUsuarioDePrueba(dataSource, {
        negocio: negocioA,
        rol: 'EMPLEADO',
      });
      const { body } = await http()
        .post('/api/auth/login')
        .send({ usuario: empleado.usuario, clave: empleado.clave })
        .expect(200);
      expect(body.usuario.rol).toBe(ROL_EMPLEADO);
      expect(
        body.menu.map((g: { nombre: string; hijos: { nombre: string }[] }) => [
          g.nombre,
          nombres(g.hijos),
        ]),
      ).toEqual([
        ['Ventas', ['Punto de venta', 'Ventas']],
        ['Inventario', ['Stock y kardex']],
        ['Catálogo', ['Líneas', 'Productos']],
      ]);
      const permisos = (body.permisos as FilaPar[]).map(
        (p) => `${p.modulo}.${p.opcion}`,
      );
      expect(permisos).toContain('pos.crear');
      expect(permisos).not.toContain('productos.crear');
      expect(permisos.some((p) => p.endsWith('.ver_costos'))).toBe(false);
    });

    it('un módulo con otra opción pero sin `ver` no aparece en el menú', async () => {
      const { token } = await conPermisos(negocioA, ['productos.crear']);
      const { body } = await http()
        .get('/api/auth/sesion')
        .set(en(token))
        .expect(200);
      expect(body.menu).toEqual([]);
      expect(body.permisos).toEqual([{ modulo: 'productos', opcion: 'crear' }]);
    });

    it('GET /auth/sesion coincide con el login y refleja un cambio de permisos con el mismo token', async () => {
      const { u, idRol, token } = await conPermisos(negocioA, ['pos.ver']);
      const login = await http()
        .post('/api/auth/login')
        .send({ usuario: u.usuario, clave: u.clave })
        .expect(200);
      const sesion = await http()
        .get('/api/auth/sesion')
        .set(en(token))
        .expect(200);
      expect(sesion.body).toEqual({
        usuario: login.body.usuario,
        menu: login.body.menu,
        permisos: login.body.permisos,
      });

      await http()
        .put(`/api/roles/${idRol}/permisos`)
        .set(en(tokenDuenoA))
        .send(permisosBody('pos.ver', 'productos.ver'))
        .expect(200);
      const despues = await http()
        .get('/api/auth/sesion')
        .set(en(token))
        .expect(200);
      expect(nombres(despues.body.menu)).toEqual(['Ventas', 'Catálogo']);
    });

    it('el rol de plataforma ve solo «Plataforma» y ningún módulo de negocio', async () => {
      const admin = await crearUsuarioDePrueba(dataSource, { negocio: null });
      const servicio = app.get(PermisoService);
      const menu = await servicio.menuDelRol(admin.idRolUsuario);
      expect(menu).toHaveLength(1);
      expect(menu[0].nombre).toBe('Plataforma');
      expect(menu[0].hijos?.map((h) => h.codigo)).toEqual([
        'negocios',
        'bitacora_plataforma',
      ]);
      expect(await servicio.tiene(admin.idRolUsuario, 'productos', 'ver')).toBe(
        false,
      );
      const rol = await dataSource
        .getRepository(RolUsuario)
        .findOneByOrFail({ idRolUsuario: admin.idRolUsuario });
      expect(rol.nombre).toBe(ROL_PLATAFORMA);
      expect(rol.esFijo).toBe(true);
    });
  });

  describe('@RequierePermiso y PermisoGuard', () => {
    it('200 con el permiso y 403 sin él', async () => {
      const { token } = await conPermisos(negocioA, ['productos.ver']);
      await http()
        .get('/api/prueba-permisos/productos')
        .set(en(token))
        .expect(200);
      const respuesta = await http()
        .post('/api/prueba-permisos/productos')
        .set(en(token))
        .expect(403);
      expect(respuesta.body.message).toBe(
        'No tiene permiso para esta operación.',
      );
    });

    it('sin token, 401', async () => {
      await http().get('/api/prueba-permisos/productos').expect(401);
    });

    it('quitar el permiso por la API rige en la siguiente petición con el mismo token', async () => {
      const { idRol, token } = await conPermisos(negocioA, ['productos.ver']);
      await http()
        .get('/api/prueba-permisos/productos')
        .set(en(token))
        .expect(200);

      await http()
        .put(`/api/roles/${idRol}/permisos`)
        .set(en(tokenDuenoA))
        .send(permisosBody())
        .expect(200);
      await http()
        .get('/api/prueba-permisos/productos')
        .set(en(token))
        .expect(403);

      await http()
        .put(`/api/roles/${idRol}/permisos`)
        .set(en(tokenDuenoA))
        .send(permisosBody('productos.ver'))
        .expect(200);
      await http()
        .get('/api/prueba-permisos/productos')
        .set(en(token))
        .expect(200);
    });

    it('un rol dado de baja deja a sus usuarios sin permisos', async () => {
      const { idRol, token } = await conPermisos(negocioA, ['productos.ver']);
      await dataSource.query(
        'UPDATE rol_usuario SET id_estado = 0 WHERE id_rol_usuario = $1',
        [idRol],
      );
      await http()
        .get('/api/prueba-permisos/productos')
        .set(en(token))
        .expect(403);
    });

    it('denegar por defecto: una ruta sin marca responde 403 aun al Dueño', async () => {
      await http()
        .get('/api/prueba-permisos/sin-marca')
        .set(en(tokenDuenoA))
        .expect(403);
    });

    it('el rol de plataforma no tiene permisos de negocio, solo los suyos', async () => {
      // El admin necesita la 2FA para tener sesión: se prueba su rol directamente.
      const admin = await crearUsuarioDePrueba(dataSource, { negocio: null });
      const servicio = app.get(PermisoService);
      expect(await servicio.tiene(admin.idRolUsuario, 'roles', 'ver')).toBe(
        false,
      );
      expect(await servicio.tiene(admin.idRolUsuario, 'negocios', 'ver')).toBe(
        true,
      );
    });
  });

  describe('omitir costos sin `ver_costos` (decisión 49)', () => {
    const completa = {
      nombre: 'Leche',
      costoUnitario: '3.5000',
      valor: '10.00',
      lotes: [{ lote: 1, costoUnitario: '3.0000' }],
    };

    it('el Dueño recibe los costos', async () => {
      const { body } = await http()
        .get('/api/prueba-permisos/costos')
        .set(en(tokenDuenoA))
        .expect(200);
      expect(body).toEqual(completa);
    });

    it('sin `ver_costos` no llegan, en ningún nivel', async () => {
      const { token } = await conPermisos(negocioA, ['productos.ver']);
      const { body } = await http()
        .get('/api/prueba-permisos/costos')
        .set(en(token))
        .expect(200);
      expect(body).toEqual({ nombre: 'Leche', lotes: [{ lote: 1 }] });
    });

    it('con `ver_costos` en otro módulo tampoco', async () => {
      const { token } = await conPermisos(negocioA, [
        'productos.ver',
        'ventas.ver_costos',
      ]);
      const { body } = await http()
        .get('/api/prueba-permisos/costos')
        .set(en(token))
        .expect(200);
      expect(body.costoUnitario).toBeUndefined();
    });

    it('al darle `ver_costos` del módulo, llegan', async () => {
      const { token } = await conPermisos(negocioA, [
        'productos.ver',
        'productos.ver_costos',
      ]);
      const { body } = await http()
        .get('/api/prueba-permisos/costos')
        .set(en(token))
        .expect(200);
      expect(body).toEqual(completa);
    });
  });

  describe('roles y matriz de permisos', () => {
    it('lista los roles del negocio con el Dueño fijo', async () => {
      const roles = await rolesDe(tokenDuenoA);
      expect(roles.find((r) => r.nombre === ROL_DUENO)?.esFijo).toBe(true);
      expect(roles.find((r) => r.nombre === ROL_EMPLEADO)?.esFijo).toBe(false);
      expect(roles.some((r) => r.nombre === ROL_PLATAFORMA)).toBe(false);
    });

    it('la matriz solo tiene casillas que existen y es de ámbito NEGOCIO', async () => {
      const empleado = await rolPorNombre(tokenDuenoA, ROL_EMPLEADO);
      const { body } = await http()
        .get(`/api/roles/${empleado.idRolUsuario}/permisos`)
        .set(en(tokenDuenoA))
        .expect(200);
      expect(body.rol.nombre).toBe(ROL_EMPLEADO);
      const lineas = body.modulos.find(
        (m: { codigo: string }) => m.codigo === 'lineas',
      );
      expect(lineas.grupo).toBe('Catálogo');
      expect(lineas.opciones.map((o: { codigo: string }) => o.codigo)).toEqual([
        'ver',
        'crear',
        'editar',
        'eliminar',
      ]);
      expect(
        lineas.opciones.find((o: { codigo: string }) => o.codigo === 'ver')
          .activo,
      ).toBe(true);
      const codigos = body.modulos.map((m: { codigo: string }) => m.codigo);
      expect(codigos).not.toContain('negocios');
      expect(codigos).toHaveLength(
        MODULOS_CATALOGO.filter((m) => m.ambito === 'NEGOCIO').length,
      );
    });

    it('el rol Dueño no se edita: PUT de permisos, PATCH y DELETE responden 409', async () => {
      const dueno = await rolPorNombre(tokenDuenoA, ROL_DUENO);
      const antes = await activos(dueno.idRolUsuario);

      await http()
        .put(`/api/roles/${dueno.idRolUsuario}/permisos`)
        .set(en(tokenDuenoA))
        .send(permisosBody('pos.ver'))
        .expect(409);
      await http()
        .patch(`/api/roles/${dueno.idRolUsuario}`)
        .set(en(tokenDuenoA))
        .send({ nombre: 'Jefe' })
        .expect(409);
      await http()
        .delete(`/api/roles/${dueno.idRolUsuario}`)
        .set(en(tokenDuenoA))
        .expect(409);

      expect(await activos(dueno.idRolUsuario)).toEqual(antes);
      expect((await rolPorNombre(tokenDuenoA, ROL_DUENO)).nombre).toBe(
        ROL_DUENO,
      );
    });

    it('crea un rol sin permisos, lo edita, le da permisos y lo da de baja', async () => {
      const creado = await http()
        .post('/api/roles')
        .set(en(tokenDuenoA))
        .send({ nombre: '  Cajero  ', descripcion: 'Caja' })
        .expect(201);
      expect(creado.body).toMatchObject({
        nombre: 'Cajero',
        descripcion: 'Caja',
        esFijo: false,
      });
      const id = creado.body.idRolUsuario as number;
      expect(await activos(id)).toEqual([]);

      await http()
        .post('/api/roles')
        .set(en(tokenDuenoA))
        .send({ nombre: 'CAJERO' })
        .expect(409);

      await http()
        .patch(`/api/roles/${id}`)
        .set(en(tokenDuenoA))
        .send({ nombre: 'Cajero 2' })
        .expect(200);
      await http()
        .put(`/api/roles/${id}/permisos`)
        .set(en(tokenDuenoA))
        .send(permisosBody('pos.ver', 'pos.crear'))
        .expect(200);
      expect(await activos(id)).toEqual(['pos.crear', 'pos.ver']);

      await http().delete(`/api/roles/${id}`).set(en(tokenDuenoA)).expect(204);
      expect(
        (await rolesDe(tokenDuenoA)).some((r) => r.idRolUsuario === id),
      ).toBe(false);
      // El nombre queda libre tras la baja.
      await http()
        .post('/api/roles')
        .set(en(tokenDuenoA))
        .send({ nombre: 'Cajero 2' })
        .expect(201);
    });

    it('no se da de baja un rol con usuarios activos', async () => {
      const { idRol } = await conPermisos(negocioA, ['pos.ver']);
      const { body } = await http()
        .delete(`/api/roles/${idRol}`)
        .set(en(tokenDuenoA))
        .expect(409);
      expect(body.message).toMatch(/usuario\(s\) activo\(s\)/);
    });

    it('un par que no existe responde 400 y no cambia nada', async () => {
      const idRol = await crearRol(negocioA, ['pos.ver']);
      for (const pares of [
        ['productos.anular'], // la opción existe, pero no en ese módulo
        ['no_existe.ver'], // módulo inexistente
        ['negocios.ver'], // módulo de otro ámbito
        ['pos.ver', 'pos.volar'], // opción inexistente
      ]) {
        const { body } = await http()
          .put(`/api/roles/${idRol}/permisos`)
          .set(en(tokenDuenoA))
          .send(permisosBody(...pares))
          .expect(400);
        expect(body.message).toMatch(/no existen/);
      }
      await http()
        .put(`/api/roles/${idRol}/permisos`)
        .set(en(tokenDuenoA))
        .send({ permisos: 'todos' })
        .expect(400);
      expect(await activos(idRol)).toEqual(['pos.ver']);
    });

    it('el PUT registra en la bitácora solo el diff, con el usuario y el negocio', async () => {
      const idRol = await crearRol(negocioA, ['pos.ver', 'ventas.ver']);
      await http()
        .put(`/api/roles/${idRol}/permisos`)
        .set(en(tokenDuenoA))
        .send(permisosBody('pos.ver', 'productos.ver'))
        .expect(200);
      const filas = await dataSource.query<
        {
          id_usuario: number;
          id_negocio: number;
          detalle: Record<string, unknown>;
        }[]
      >(
        `SELECT id_usuario, id_negocio, detalle FROM bitacora
         WHERE evento = 'CAMBIO_PERMISOS' AND (detalle->>'idRolUsuario')::int = $1`,
        [idRol],
      );
      expect(filas).toHaveLength(1);
      expect(filas[0].id_usuario).toBe(duenoA.idUsuario);
      expect(filas[0].id_negocio).toBe(negocioA.idNegocio);
      expect(filas[0].detalle).toMatchObject({
        activados: ['productos.ver'],
        desactivados: ['ventas.ver'],
      });

      // Sin cambios, no hay evento.
      await http()
        .put(`/api/roles/${idRol}/permisos`)
        .set(en(tokenDuenoA))
        .send(permisosBody('pos.ver', 'productos.ver'))
        .expect(200);
      const otra = await dataSource.query<unknown[]>(
        `SELECT 1 FROM bitacora WHERE evento = 'CAMBIO_PERMISOS' AND (detalle->>'idRolUsuario')::int = $1`,
        [idRol],
      );
      expect(otra).toHaveLength(1);
    });

    it('sin el permiso `roles` no se leen ni se editan los roles', async () => {
      const { token } = await conPermisos(negocioA, ['productos.ver']);
      await http().get('/api/roles').set(en(token)).expect(403);
      await http()
        .post('/api/roles')
        .set(en(token))
        .send({ nombre: 'X' })
        .expect(403);
    });
  });

  describe('anti-escalada (decisión 99)', () => {
    it('solo cambia pares que el propio rol tiene activos', async () => {
      const editor = await conPermisos(negocioA, [
        'roles.ver',
        'roles.editar',
        'productos.ver',
      ]);
      const objetivo = await crearRol(negocioA, ['pos.ver']);
      const url = `/api/roles/${objetivo}/permisos`;
      const put = (token: string, ...pares: string[]) =>
        http()
          .put(url)
          .set(en(token))
          .send(permisosBody(...pares));

      // Quitar `pos.ver`, que el editor no tiene, tampoco se permite.
      const quita = await put(editor.token, 'productos.ver').expect(403);
      expect(quita.body.message).toContain('pos.ver');
      // Dar lo que no tiene.
      const da = await put(
        editor.token,
        'pos.ver',
        'productos.ver',
        'productos.ver_costos',
      ).expect(403);
      expect(da.body.message).toContain('productos.ver_costos');
      expect(await activos(objetivo)).toEqual(['pos.ver']);

      // Dar lo que sí tiene.
      await put(editor.token, 'pos.ver', 'productos.ver').expect(200);
      expect(await activos(objetivo)).toEqual(['pos.ver', 'productos.ver']);
    });

    it('nadie edita los permisos de su propio rol', async () => {
      const editor = await conPermisos(negocioA, [
        'roles.ver',
        'roles.editar',
        'productos.ver',
      ]);
      const { body } = await http()
        .put(`/api/roles/${editor.idRol}/permisos`)
        .set(en(editor.token))
        .send(permisosBody('roles.ver', 'roles.editar', 'productos.ver'))
        .expect(409);
      expect(body.message).toMatch(/propio rol/);
    });

    it('un empleado con `roles.editar` no puede darse ver_costos por otro rol suyo', async () => {
      const editor = await conPermisos(negocioA, ['roles.ver', 'roles.editar']);
      const otro = await crearRol(negocioA, []);
      await http()
        .put(`/api/roles/${otro}/permisos`)
        .set(en(editor.token))
        .send(permisosBody('productos.ver_costos'))
        .expect(403);
      expect(await activos(otro)).toEqual([]);
    });
  });

  describe('aislamiento entre negocios (decisión 30)', () => {
    it('el dueño de B no lista, lee ni modifica los roles de A', async () => {
      const deA = await rolPorNombre(tokenDuenoA, ROL_EMPLEADO);
      const deB = await rolesDe(tokenDuenoB);
      expect(deB.map((r) => r.idRolUsuario)).not.toContain(deA.idRolUsuario);
      expect(deB.map((r) => r.nombre).sort()).toEqual(
        [ROL_DUENO, ROL_EMPLEADO].sort(),
      );

      const url = `/api/roles/${deA.idRolUsuario}`;
      await http().get(`${url}/permisos`).set(en(tokenDuenoB)).expect(404);
      await http()
        .put(`${url}/permisos`)
        .set(en(tokenDuenoB))
        .send(permisosBody('pos.ver'))
        .expect(404);
      await http()
        .patch(url)
        .set(en(tokenDuenoB))
        .send({ nombre: 'Robado' })
        .expect(404);
      await http().delete(url).set(en(tokenDuenoB)).expect(404);
      expect((await rolPorNombre(tokenDuenoA, ROL_EMPLEADO)).nombre).toBe(
        ROL_EMPLEADO,
      );
    });

    it('el rol de plataforma no es visible ni editable desde un negocio', async () => {
      const [{ id }] = await dataSource.query<{ id: number }[]>(
        `SELECT id_rol_usuario AS id FROM rol_usuario WHERE id_negocio IS NULL AND es_fijo`,
      );
      expect(
        (await rolesDe(tokenDuenoA)).map((r) => r.idRolUsuario),
      ).not.toContain(id);
      await http()
        .get(`/api/roles/${id}/permisos`)
        .set(en(tokenDuenoA))
        .expect(404);
      await http()
        .put(`/api/roles/${id}/permisos`)
        .set(en(tokenDuenoA))
        .send(permisosBody('pos.ver'))
        .expect(404);
    });

    it('el mismo nombre de rol puede existir en dos negocios', async () => {
      await http()
        .post('/api/roles')
        .set(en(tokenDuenoA))
        .send({ nombre: 'Supervisor' })
        .expect(201);
      await http()
        .post('/api/roles')
        .set(en(tokenDuenoB))
        .send({ nombre: 'Supervisor' })
        .expect(201);
    });
  });
});
