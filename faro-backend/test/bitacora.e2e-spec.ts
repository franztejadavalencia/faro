import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { Negocio } from '../src/plataforma/entities/negocio.entity';
import { crearApp } from './utils/crear-app';
import { limpiarBase } from './utils/limpiar-base';
import { crearUsuarioConPermisos } from './utils/roles-de-prueba';
import {
  crearNegocioDePrueba,
  crearUsuarioDePrueba,
  UsuarioDePrueba,
} from './utils/usuarios-de-prueba';

interface Item {
  id: number;
  fecha: string;
  evento: string;
  usuario: { id: number; nombre: string } | null;
  ip: string | null;
  detalle: Record<string, unknown> | null;
  url: string | null;
  metodo: string | null;
}

interface Pagina {
  items: Item[];
  total: number;
  pagina: number;
  tamano: number;
}

/**
 * Consulta de la bitácora del negocio (B7, decisiones 51 y 84). Las filas de
 * prueba llevan fechas de 2025 y horas locales de La Paz (UTC-4) que cruzan
 * la medianoche UTC: así se prueba que `desde` y `hasta` son días locales.
 */
describe('Bitácora del negocio (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let negocioA: Negocio;
  let negocioB: Negocio;
  let duenoA: UsuarioDePrueba;
  let empleadoA: UsuarioDePrueba;
  let duenoB: UsuarioDePrueba;
  let tokenDuenoA: string;
  let tokenDuenoB: string;
  /** `id_bitacora` de cada fila sembrada, por nombre. */
  const filas: Record<string, number> = {};

  const http = () => request(app.getHttpServer());
  const en = (token: string) => ({ Authorization: `Bearer ${token}` });
  const tokenDe = async (u: UsuarioDePrueba): Promise<string> =>
    (
      await http()
        .post('/api/auth/login')
        .send({ usuario: u.usuario, clave: u.clave })
        .expect(200)
    ).body.token as string;
  const consultar = (token: string, query: string) =>
    http().get(`/api/bitacora?${query}`).set(en(token));
  const pagina = async (token: string, query: string): Promise<Pagina> =>
    (await consultar(token, query).expect(200)).body as Pagina;
  const nombres = (p: Pagina) =>
    p.items.map((i) => Object.keys(filas).find((k) => filas[k] === i.id));

  async function sembrar(
    nombre: string,
    datos: {
      idNegocio: number | null;
      idUsuario: number | null;
      evento: string;
      fecha: string;
    },
  ): Promise<void> {
    const [{ id }] = await dataSource.query<{ id: number }[]>(
      `INSERT INTO bitacora (id_negocio, id_usuario, evento, detalle, ip, user_agent, url, metodo, fecha)
       VALUES ($1, $2, $3, '{"motivo":"prueba"}', '10.0.0.9', 'agente-secreto/1.0', '/api/x', 'POST', $4)
       RETURNING id_bitacora AS id`,
      [datos.idNegocio, datos.idUsuario, datos.evento, datos.fecha],
    );
    filas[nombre] = id;
  }

  beforeAll(async () => {
    app = await crearApp();
    dataSource = app.get(DataSource);
    await limpiarBase(dataSource);
    negocioA = await crearNegocioDePrueba(dataSource, 'Tienda A');
    negocioB = await crearNegocioDePrueba(dataSource, 'Tienda B');
    duenoA = await crearUsuarioDePrueba(dataSource, { negocio: negocioA });
    empleadoA = await crearUsuarioDePrueba(dataSource, {
      negocio: negocioA,
      rol: 'EMPLEADO',
    });
    duenoB = await crearUsuarioDePrueba(dataSource, { negocio: negocioB });

    const A = negocioA.idNegocio;
    // Horas locales (-04). e2 y e4 cruzan la medianoche UTC; e5 es el día siguiente.
    await sembrar('e1', {
      idNegocio: A,
      idUsuario: duenoA.idUsuario,
      evento: 'LOGIN_OK',
      fecha: '2025-03-10 12:00:00-04',
    });
    await sembrar('e2', {
      idNegocio: A,
      idUsuario: empleadoA.idUsuario,
      evento: 'LOGIN_FALLIDO',
      fecha: '2025-03-11 23:30:00-04',
    });
    await sembrar('e3', {
      idNegocio: A,
      idUsuario: duenoA.idUsuario,
      evento: 'CAMBIO_PERMISOS',
      fecha: '2025-03-12 00:30:00-04',
    });
    await sembrar('e4', {
      idNegocio: A,
      idUsuario: empleadoA.idUsuario,
      evento: 'LOGIN_OK',
      fecha: '2025-03-12 23:59:59-04',
    });
    await sembrar('e5', {
      idNegocio: A,
      idUsuario: duenoA.idUsuario,
      evento: 'LOGIN_OK',
      fecha: '2025-03-13 00:00:00-04',
    });
    // Lo que no es de A: otro negocio, la plataforma y un usuario inexistente.
    await sembrar('b1', {
      idNegocio: negocioB.idNegocio,
      idUsuario: duenoB.idUsuario,
      evento: 'LOGIN_OK',
      fecha: '2025-03-11 10:00:00-04',
    });
    await sembrar('p1', {
      idNegocio: null,
      idUsuario: null,
      evento: 'LOGIN_FALLIDO',
      fecha: '2025-03-11 11:00:00-04',
    });
    tokenDuenoA = await tokenDe(duenoA);
    tokenDuenoB = await tokenDe(duenoB);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('filtros', () => {
    it('desde y hasta son días locales, inclusivos', async () => {
      // El día 11 local: e2 (23:30 local, ya es el 12 en UTC) y no e3 (00:30 del 12).
      expect(
        nombres(await pagina(tokenDuenoA, 'desde=2025-03-11&hasta=2025-03-11')),
      ).toEqual(['e2']);
      // El 12 local entero: e4 (23:59:59) y e3 (00:30), sin e5 (00:00 del 13).
      expect(
        nombres(await pagina(tokenDuenoA, 'desde=2025-03-12&hasta=2025-03-12')),
      ).toEqual(['e4', 'e3']);
      // Un rango: del 10 al 12, de más reciente a más antiguo.
      expect(
        nombres(await pagina(tokenDuenoA, 'desde=2025-03-10&hasta=2025-03-12')),
      ).toEqual(['e4', 'e3', 'e2', 'e1']);
      // Solo desde: incluye lo de después.
      expect(
        nombres(await pagina(tokenDuenoA, 'desde=2025-03-13&hasta=2025-03-13')),
      ).toEqual(['e5']);
    });

    it('por usuario, por evento y combinados', async () => {
      const ventana = 'desde=2025-03-10&hasta=2025-03-13';
      expect(
        nombres(
          await pagina(tokenDuenoA, `${ventana}&idUsuario=${duenoA.idUsuario}`),
        ),
      ).toEqual(['e5', 'e3', 'e1']);
      expect(
        nombres(await pagina(tokenDuenoA, `${ventana}&evento=LOGIN_OK`)),
      ).toEqual(['e5', 'e4', 'e1']);
      expect(
        nombres(
          await pagina(
            tokenDuenoA,
            `${ventana}&evento=LOGIN_OK&idUsuario=${empleadoA.idUsuario}`,
          ),
        ),
      ).toEqual(['e4']);
      expect(
        (await pagina(tokenDuenoA, `${ventana}&evento=ACTIVACION_2FA`)).total,
      ).toBe(0);
    });

    it('pagina, con el total y un tope de 100', async () => {
      const ventana = 'desde=2025-03-10&hasta=2025-03-13';
      const primera = await pagina(tokenDuenoA, `${ventana}&tamano=2&pagina=1`);
      const segunda = await pagina(tokenDuenoA, `${ventana}&tamano=2&pagina=2`);
      const tercera = await pagina(tokenDuenoA, `${ventana}&tamano=2&pagina=3`);
      expect(primera).toMatchObject({ total: 5, pagina: 1, tamano: 2 });
      expect(nombres(primera)).toEqual(['e5', 'e4']);
      expect(nombres(segunda)).toEqual(['e3', 'e2']);
      expect(nombres(tercera)).toEqual(['e1']);
      expect((await pagina(tokenDuenoA, ventana)).tamano).toBe(50);
      await consultar(tokenDuenoA, 'tamano=101').expect(400);
      await consultar(tokenDuenoA, 'tamano=0').expect(400);
      await consultar(tokenDuenoA, 'pagina=0').expect(400);
    });

    it('rechaza filtros inválidos', async () => {
      await consultar(tokenDuenoA, 'evento=NO_EXISTE').expect(400);
      await consultar(tokenDuenoA, 'desde=2025-13-45').expect(400);
      await consultar(tokenDuenoA, 'desde=ayer').expect(400);
      await consultar(tokenDuenoA, 'idUsuario=abc').expect(400);
      await consultar(tokenDuenoA, 'desde=2025-03-12&hasta=2025-03-11').expect(
        400,
      );
      await consultar(tokenDuenoA, 'idNegocio=2').expect(400);
    });
  });

  describe('aislamiento (decisión 84)', () => {
    it('solo muestra eventos del negocio: ni los de otro negocio ni los de plataforma', async () => {
      const todo = await pagina(
        tokenDuenoA,
        'tamano=100&desde=2025-03-01&hasta=2025-03-31',
      );
      expect(todo.total).toBe(5);
      const ids = todo.items.map((i) => i.id);
      expect(ids).not.toContain(filas.b1);
      expect(ids).not.toContain(filas.p1);

      const deB = await pagina(
        tokenDuenoB,
        'desde=2025-03-01&hasta=2025-03-31',
      );
      expect(nombres(deB)).toEqual(['b1']);
    });

    it('un idUsuario de otro negocio no da filas ni error', async () => {
      const p = await pagina(
        tokenDuenoA,
        `desde=2025-03-01&hasta=2025-03-31&idUsuario=${duenoB.idUsuario}`,
      );
      expect(p).toMatchObject({ total: 0, items: [] });
    });

    it('el negocio sale de la sesión, no de la consulta', async () => {
      await consultar(
        tokenDuenoA,
        `idNegocio=${negocioB.idNegocio}&desde=2025-03-01`,
      ).expect(400);
    });
  });

  describe('contenido', () => {
    it('trae usuario con nombre, ip, detalle, url y método, y no el user agent ni secretos', async () => {
      const p = await pagina(tokenDuenoA, 'desde=2025-03-10&hasta=2025-03-10');
      expect(p.items).toHaveLength(1);
      expect(p.items[0]).toMatchObject({
        evento: 'LOGIN_OK',
        usuario: { id: duenoA.idUsuario },
        ip: '10.0.0.9',
        detalle: { motivo: 'prueba' },
        url: '/api/x',
        metodo: 'POST',
      });
      expect(typeof p.items[0].usuario?.nombre).toBe('string');
      expect(JSON.stringify(p)).not.toMatch(
        /agente-secreto|userAgent|user_agent/,
      );
    });

    it('registra el login real del dueño, con su nombre', async () => {
      const p = await pagina(tokenDuenoA, 'evento=LOGIN_OK&tamano=1');
      expect(p.items[0].usuario?.id).toBe(duenoA.idUsuario);
      expect(p.items[0].usuario?.nombre).toBe('Persona 1 Prueba');
    });

    it('GET /bitacora/eventos lista los eventos que existen', async () => {
      const { body } = await http()
        .get('/api/bitacora/eventos')
        .set(en(tokenDuenoA))
        .expect(200);
      expect(body).toEqual(
        expect.arrayContaining(['LOGIN_OK', 'CAMBIO_PERMISOS']),
      );
      expect([...body].sort()).toEqual(body);
    });

    it('es de solo lectura: no hay rutas para escribir', async () => {
      await http()
        .post('/api/bitacora')
        .set(en(tokenDuenoA))
        .send({})
        .expect(404);
      await http().delete('/api/bitacora/1').set(en(tokenDuenoA)).expect(404);
    });
  });

  describe('permiso', () => {
    it('sin `bitacora.ver` responde 403 (consulta y eventos)', async () => {
      const u = await crearUsuarioConPermisos(dataSource, negocioA, [
        'pos.ver',
      ]);
      const token = await tokenDe(u);
      await consultar(token, '').expect(403);
      await http().get('/api/bitacora/eventos').set(en(token)).expect(403);
    });

    it('con `bitacora.ver` consulta lo de su negocio', async () => {
      const u = await crearUsuarioConPermisos(dataSource, negocioA, [
        'bitacora.ver',
      ]);
      const token = await tokenDe(u);
      const p = await pagina(token, 'desde=2025-03-10&hasta=2025-03-10');
      expect(nombres(p)).toEqual(['e1']);
    });

    it('sin sesión responde 401', async () => {
      await http().get('/api/bitacora').expect(401);
    });
  });
});
