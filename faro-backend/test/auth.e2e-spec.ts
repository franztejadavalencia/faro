import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { Negocio } from '../src/plataforma/entities/negocio.entity';
import { Usuario } from '../src/seguridad/entities/usuario.entity';
import { crearApp } from './utils/crear-app';
import { limpiarBase } from './utils/limpiar-base';
import { ModuloProtegido } from './utils/controlador-protegido';
import {
  claveAleatoria,
  crearNegocioDePrueba,
  crearUsuarioDePrueba,
  UsuarioDePrueba,
} from './utils/usuarios-de-prueba';

const CREDENCIALES_INVALIDAS = {
  statusCode: 401,
  message: 'Credenciales inválidas',
  error: 'Unauthorized',
};

interface FilaBitacora {
  evento: string;
  id_usuario: number | null;
  id_negocio: number | null;
  detalle: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  url: string | null;
  metodo: string | null;
}

describe('Auth: login, guard JWT, cambio de clave y bloqueo (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let negocio: Negocio;

  beforeAll(async () => {
    app = await crearApp([ModuloProtegido]);
    dataSource = app.get(DataSource);
    await limpiarBase(dataSource);
    negocio = await crearNegocioDePrueba(dataSource, 'Tienda Central');
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const login = (usuario: string, clave: string) =>
    http()
      .post('/api/auth/login')
      .set('User-Agent', 'faro-e2e/1.0')
      .send({ usuario, clave });
  const yo = (token: string) =>
    http().get('/api/prueba-auth/yo').set('Authorization', `Bearer ${token}`);
  const tokenDe = async (u: UsuarioDePrueba): Promise<string> =>
    (await login(u.usuario, u.clave).expect(200)).body.token as string;
  const filaUsuario = (idUsuario: number) =>
    dataSource
      .getRepository(Usuario)
      .findOneByOrFail({ idUsuario }) as Promise<Usuario>;
  const bitacoraDe = (idUsuario: number) =>
    dataSource.query<FilaBitacora[]>(
      `SELECT * FROM bitacora WHERE id_usuario = $1 ORDER BY id_bitacora`,
      [idUsuario],
    );
  const empleado = (opciones: { debeCambiarClave?: boolean } = {}) =>
    crearUsuarioDePrueba(dataSource, { negocio, ...opciones });

  describe('login', () => {
    it('el dueño entra: respuesta de §11 con su negocio', async () => {
      const u = await crearUsuarioDePrueba(dataSource, {
        negocio,
        nombre: 'Ana',
      });
      const { body } = await login(u.usuario, u.clave).expect(200);
      expect(body).toEqual({
        estado: 'OK',
        token: expect.any(String),
        usuario: {
          id: u.idUsuario,
          nombre: 'Ana Prueba',
          debeCambiarClave: false,
          negocio: { id: negocio.idNegocio, nombre: 'Tienda Central' },
          rol: null,
        },
        menu: [],
        permisos: [],
      });
      const contexto = await yo(body.token).expect(200);
      expect(contexto.body).toMatchObject({
        idUsuario: u.idUsuario,
        idNegocio: negocio.idNegocio,
      });
    });

    it('el admin de plataforma entra con negocio null', async () => {
      const admin = await crearUsuarioDePrueba(dataSource, { negocio: null });
      const { body } = await login(admin.usuario, admin.clave).expect(200);
      expect(body.usuario.negocio).toBeNull();
      const contexto = await yo(body.token).expect(200);
      expect(contexto.body.idNegocio).toBeNull();
    });

    it('el usuario no distingue mayúsculas ni espacios alrededor', async () => {
      const u = await empleado();
      await login(`  ${u.usuario.toUpperCase()} `, u.clave).expect(200);
    });

    it('clave mala y usuario inexistente: 401 con el mismo cuerpo', async () => {
      const u = await empleado();
      const mala = await login(u.usuario, 'otra-clave-123').expect(401);
      const inexistente = await login('nadie-existe', 'otra-clave-123').expect(
        401,
      );
      expect(mala.body).toEqual(CREDENCIALES_INVALIDAS);
      expect(inexistente.body).toEqual(CREDENCIALES_INVALIDAS);
    });

    it('400 con un body sin formato válido', async () => {
      await http().post('/api/auth/login').send({ usuario: 'x' }).expect(400);
    });

    it('un token vencido en la cabecera no impide el login (ruta pública)', async () => {
      const u = await empleado();
      await http()
        .post('/api/auth/login')
        .set('Authorization', 'Bearer basura')
        .send({ usuario: u.usuario, clave: u.clave })
        .expect(200);
    });
  });

  describe('bloqueo temporal (decisión 53)', () => {
    it('4 fallos no bloquean; el 5.º sí, incluso con la clave correcta después', async () => {
      const u = await empleado();
      for (let i = 1; i <= 4; i++) {
        await login(u.usuario, 'clave-equivocada').expect(401);
      }
      expect((await filaUsuario(u.idUsuario)).intentosFallidos).toBe(4);
      expect((await filaUsuario(u.idUsuario)).bloqueadoHasta).toBeNull();

      await login(u.usuario, 'clave-equivocada').expect(401);
      const bloqueado = await filaUsuario(u.idUsuario);
      expect(bloqueado.intentosFallidos).toBe(0);
      const minutos =
        (bloqueado.bloqueadoHasta!.getTime() - Date.now()) / 60_000;
      expect(minutos).toBeGreaterThan(14);
      expect(minutos).toBeLessThanOrEqual(15);

      const conClaveCorrecta = await login(u.usuario, u.clave).expect(401);
      expect(conClaveCorrecta.body).toEqual(CREDENCIALES_INVALIDAS);
      // Durante el bloqueo no suma ni alarga.
      await login(u.usuario, 'clave-equivocada').expect(401);
      const igual = await filaUsuario(u.idUsuario);
      expect(igual.intentosFallidos).toBe(0);
      expect(igual.bloqueadoHasta).toEqual(bloqueado.bloqueadoHasta);

      // Pasados los 15 min (hora real: se escribe en el pasado), entra.
      await dataSource.query(
        `UPDATE usuario SET bloqueado_hasta = now() - interval '1 minute' WHERE id_usuario = $1`,
        [u.idUsuario],
      );
      await login(u.usuario, u.clave).expect(200);
      const libre = await filaUsuario(u.idUsuario);
      expect(libre.intentosFallidos).toBe(0);
      expect(libre.bloqueadoHasta).toBeNull();

      const eventos = (await bitacoraDe(u.idUsuario)).map((f) =>
        f.detalle?.motivo
          ? `${f.evento}:${String(f.detalle.motivo)}`
          : f.evento,
      );
      expect(eventos).toEqual([
        ...Array(5).fill('LOGIN_FALLIDO:CLAVE_INCORRECTA'),
        'BLOQUEO_CUENTA',
        'LOGIN_FALLIDO:BLOQUEADO',
        'LOGIN_FALLIDO:BLOQUEADO',
        'LOGIN_OK',
      ]);
    });

    it('los fallos cuentan solo si son seguidos', async () => {
      const u = await empleado();
      for (let i = 0; i < 4; i++) {
        await login(u.usuario, 'clave-equivocada').expect(401);
      }
      await login(u.usuario, u.clave).expect(200);
      for (let i = 0; i < 4; i++) {
        await login(u.usuario, 'clave-equivocada').expect(401);
      }
      const fila = await filaUsuario(u.idUsuario);
      expect(fila.intentosFallidos).toBe(4);
      expect(fila.bloqueadoHasta).toBeNull();
    });

    it('5 fallos en paralelo bloquean igual (UPDATE atómico)', async () => {
      const u = await empleado();
      await Promise.all(
        Array.from({ length: 5 }, () =>
          login(u.usuario, 'clave-equivocada').expect(401),
        ),
      );
      expect((await filaUsuario(u.idUsuario)).bloqueadoHasta).not.toBeNull();
    });
  });

  describe('guard JWT', () => {
    it('sin token, mal firmado, vencido o con proposito 2fa → 401', async () => {
      const u = await empleado();
      const jwt = app.get(JwtService);
      const payload = {
        idUsuario: u.idUsuario,
        idNegocio: negocio.idNegocio,
        versionSesion: 0,
      };
      await http().get('/api/prueba-auth/yo').expect(401);
      const otroSecreto = new JwtService({
        secret: 'otro-secreto-de-al-menos-32-caracteres!',
      }).sign(payload);
      await yo(otroSecreto).expect(401);
      await yo(jwt.sign(payload, { expiresIn: -10 })).expect(401);
      await yo(jwt.sign({ ...payload, proposito: '2fa' })).expect(401);
      // El mismo payload, bien firmado, sí entra.
      await yo(jwt.sign(payload)).expect(200);
    });

    it('/api/salud responde sin token', async () => {
      await http().get('/api/salud').expect(200);
    });

    it('usuario dado de baja: 401 en el login y con un token anterior', async () => {
      const u = await empleado();
      const token = await tokenDe(u);
      await dataSource.query(
        `UPDATE usuario SET id_estado = 0 WHERE id_usuario = $1`,
        [u.idUsuario],
      );
      await yo(token).expect(401);
      expect((await login(u.usuario, u.clave).expect(401)).body).toEqual(
        CREDENCIALES_INVALIDAS,
      );
    });

    it('negocio suspendido: 401 en el login y con un token anterior, sin sumar intentos', async () => {
      const otro = await crearNegocioDePrueba(dataSource, 'Por suspender');
      const u = await crearUsuarioDePrueba(dataSource, { negocio: otro });
      const token = await tokenDe(u);
      await dataSource.query(
        `UPDATE negocio SET estado = 'SUSPENDIDO' WHERE id_negocio = $1`,
        [otro.idNegocio],
      );
      await yo(token).expect(401);
      expect((await login(u.usuario, u.clave).expect(401)).body).toEqual(
        CREDENCIALES_INVALIDAS,
      );
      expect((await filaUsuario(u.idUsuario)).intentosFallidos).toBe(0);
      const ultimo = (await bitacoraDe(u.idUsuario)).at(-1)!;
      expect(ultimo).toMatchObject({
        evento: 'LOGIN_FALLIDO',
        id_negocio: otro.idNegocio,
        detalle: { motivo: 'NEGOCIO_SUSPENDIDO' },
      });
    });
  });

  describe('debe_cambiar_clave (decisión 48)', () => {
    it('login OK, 403 en el resto y el cambio de clave sí entra', async () => {
      const u = await empleado({ debeCambiarClave: true });
      const { body } = await login(u.usuario, u.clave).expect(200);
      expect(body.usuario.debeCambiarClave).toBe(true);

      const prohibido = await yo(body.token).expect(403);
      expect(prohibido.body.message).toBe(
        'Debe cambiar su contraseña antes de continuar.',
      );

      const claveNueva = claveAleatoria();
      const cambio = await http()
        .post('/api/auth/cambiar-clave')
        .set('Authorization', `Bearer ${body.token}`)
        .send({ claveActual: u.clave, claveNueva })
        .expect(200);
      expect(cambio.body.usuario.debeCambiarClave).toBe(false);
      await yo(cambio.body.token).expect(200);
    });
  });

  describe('cambio de clave', () => {
    const cambiar = (token: string, claveActual: string, claveNueva: string) =>
      http()
        .post('/api/auth/cambiar-clave')
        .set('Authorization', `Bearer ${token}`)
        .send({ claveActual, claveNueva });

    it('sin token: 401', async () => {
      await http()
        .post('/api/auth/cambiar-clave')
        .send({ claveActual: 'a', claveNueva: 'b' })
        .expect(401);
    });

    it('clave actual mala → 400 y suma; nueva corta o igual → 400', async () => {
      const u = await empleado();
      const token = await tokenDe(u);
      const mala = await cambiar(
        token,
        'no-es-la-clave',
        claveAleatoria(),
      ).expect(400);
      expect(mala.body.message).toBe('La clave actual no es correcta.');
      expect((await filaUsuario(u.idUsuario)).intentosFallidos).toBe(1);
      await cambiar(token, u.clave, 'corta').expect(400);
      await cambiar(token, u.clave, u.clave).expect(400);
      // La sesión sigue abierta.
      await yo(token).expect(200);
      const eventos = (await bitacoraDe(u.idUsuario)).map((f) => f.evento);
      expect(eventos).toContain('CAMBIO_CLAVE_FALLIDO');
    });

    it('5 fallos al cambiar la clave bloquean el login; la sesión sigue', async () => {
      const u = await empleado();
      const token = await tokenDe(u);
      for (let i = 0; i < 5; i++) {
        await cambiar(token, 'no-es-la-clave', claveAleatoria()).expect(400);
      }
      // Ya bloqueada: ni se compara.
      await cambiar(token, u.clave, claveAleatoria()).expect(429);
      await login(u.usuario, u.clave).expect(401);
      await yo(token).expect(200);
      const eventos = (await bitacoraDe(u.idUsuario)).map((f) => f.evento);
      expect(eventos).toContain('BLOQUEO_CUENTA');
    });

    it('OK: la nueva entra, la vieja no; el token anterior da 401 y el nuevo abre', async () => {
      const u = await empleado();
      const tokenViejo = await tokenDe(u);
      const otraSesion = await tokenDe(u);
      const claveNueva = claveAleatoria();
      const { body } = await cambiar(tokenViejo, u.clave, claveNueva).expect(
        200,
      );
      expect(body.estado).toBe('OK');

      await yo(tokenViejo).expect(401);
      await yo(otraSesion).expect(401);
      await yo(body.token).expect(200);
      await login(u.usuario, u.clave).expect(401);
      await login(u.usuario, claveNueva).expect(200);

      const fila = await filaUsuario(u.idUsuario);
      expect(fila.versionSesion).toBe(1);
      expect(fila.usuarioModificacion).toBe(u.idUsuario);
      const cambio = (await bitacoraDe(u.idUsuario)).find(
        (f) => f.evento === 'CAMBIO_CLAVE',
      );
      expect(cambio).toMatchObject({
        id_negocio: negocio.idNegocio,
        url: '/api/auth/cambiar-clave',
        metodo: 'POST',
      });
    });
  });

  describe('bitácora', () => {
    it('LOGIN_OK con usuario, negocio, ip, user agent, url y método', async () => {
      const u = await empleado();
      await tokenDe(u);
      const [fila] = await bitacoraDe(u.idUsuario);
      expect(fila).toMatchObject({
        evento: 'LOGIN_OK',
        id_usuario: u.idUsuario,
        id_negocio: negocio.idNegocio,
        user_agent: 'faro-e2e/1.0',
        url: '/api/auth/login',
        metodo: 'POST',
      });
      expect(fila.ip).toEqual(expect.any(String));
    });

    it('usuario inexistente: fila de plataforma con lo escrito y sin la clave', async () => {
      const escrito = `fantasma-${claveAleatoria()}`;
      const clave = `clave-${claveAleatoria()}`;
      await login(escrito, clave).expect(401);
      const filas = await dataSource.query<FilaBitacora[]>(
        `SELECT * FROM bitacora WHERE detalle->>'usuario' = $1`,
        [escrito],
      );
      expect(filas).toHaveLength(1);
      expect(filas[0]).toMatchObject({
        evento: 'LOGIN_FALLIDO',
        id_usuario: null,
        id_negocio: null,
        detalle: { motivo: 'USUARIO_INEXISTENTE', usuario: escrito },
      });
      expect(JSON.stringify(filas[0])).not.toContain(clave);
    });

    it('ninguna fila contiene un token ni una clave', async () => {
      const u = await empleado();
      const token = await tokenDe(u);
      await yo(token).expect(200);
      await http()
        .post('/api/auth/cambiar-clave')
        .set('Authorization', `Bearer ${token}`)
        .send({ claveActual: u.clave, claveNueva: claveAleatoria() })
        .expect(200);
      const todo = JSON.stringify(
        await dataSource.query(`SELECT * FROM bitacora`),
      );
      expect(todo).not.toContain(token);
      expect(todo).not.toContain(token.split('.')[2]);
      expect(todo).not.toContain(u.clave);
    });
  });
});
