import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { Negocio } from '../src/plataforma/entities/negocio.entity';
import { CifradoTotpService } from '../src/seguridad/auth/services/cifrado-totp.service';
import { Usuario } from '../src/seguridad/entities/usuario.entity';
import { generarSecretoTotp } from '../src/seguridad/utils/totp';
import { crearApp } from './utils/crear-app';
import { limpiarBase } from './utils/limpiar-base';
import { ModuloProtegido } from './utils/controlador-protegido';
import { codigoTotp, secretoDeUri } from './utils/totp-de-prueba';
import {
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
  detalle: Record<string, unknown> | null;
  ip: string | null;
}

describe('2FA TOTP: configurar, verificar, respaldo y antirreúso (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let negocio: Negocio;

  beforeAll(async () => {
    app = await crearApp([ModuloProtegido]);
    dataSource = app.get(DataSource);
    await limpiarBase(dataSource);
    negocio = await crearNegocioDePrueba(dataSource, 'Tienda 2FA');
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const login = (u: UsuarioDePrueba) =>
    http()
      .post('/api/auth/login')
      .set('User-Agent', 'faro-e2e/1.0')
      .send({ usuario: u.usuario, clave: u.clave });
  const conToken = (token: string) => ({ Authorization: `Bearer ${token}` });
  const configurar = (token: string) =>
    http().post('/api/auth/2fa/configurar').set(conToken(token));
  const verificar = (token: string, codigo: string) =>
    http()
      .post('/api/auth/2fa/verificar')
      .set(conToken(token))
      .send({ codigo });
  const yo = (token: string) =>
    http().get('/api/prueba-auth/yo').set(conToken(token));
  const filaUsuario = (idUsuario: number) =>
    dataSource.getRepository(Usuario).findOneOrFail({
      where: { idUsuario },
      select: {
        idUsuario: true,
        totpSecreto: true,
        totpActivo: true,
        totpUltimoPaso: true,
        versionSesion: true,
        intentosFallidos: true,
        bloqueadoHasta: true,
      },
    });
  const bitacoraDe = (idUsuario: number) =>
    dataSource.query<FilaBitacora[]>(
      `SELECT evento, detalle, ip FROM bitacora WHERE id_usuario = $1 ORDER BY id_bitacora`,
      [idUsuario],
    );
  const admin = () => crearUsuarioDePrueba(dataSource, { negocio: null });

  /** Login del admin → configurar: token temporal y secreto (de la URI). */
  async function adminConfigurando() {
    const u = await admin();
    const { body } = await login(u).expect(200);
    const configurado = await configurar(body.tokenTemporal).expect(200);
    return {
      u,
      tokenTemporal: body.tokenTemporal as string,
      secreto: secretoDeUri(configurado.body.uri),
      configurado: configurado.body,
    };
  }

  /** Admin con la 2FA ya activa por la API; devuelve secreto y códigos. */
  async function adminConDosFactores() {
    const { u, tokenTemporal, secreto } = await adminConfigurando();
    const { body } = await verificar(
      tokenTemporal,
      await codigoTotp(secreto),
    ).expect(200);
    return { u, secreto, codigos: body.codigosRespaldo as string[] };
  }

  /** Token temporal de un segundo login (estado VERIFICAR_2FA). */
  async function tokenVerificar(u: UsuarioDePrueba): Promise<string> {
    const { body } = await login(u).expect(200);
    expect(body).toEqual({
      estado: 'VERIFICAR_2FA',
      tokenTemporal: expect.any(String),
    });
    return body.tokenTemporal as string;
  }

  describe('enrolamiento del admin (obligatorio)', () => {
    it('login → CONFIGURAR_2FA sin sesión; configurar → QR, URI y secreto cifrado', async () => {
      const u = await admin();
      const { body } = await login(u).expect(200);
      expect(body).toEqual({
        estado: 'CONFIGURAR_2FA',
        tokenTemporal: expect.any(String),
      });

      const { body: configurado } = await configurar(body.tokenTemporal).expect(
        200,
      );
      expect(configurado.qr).toMatch(/^data:image\/png;base64,/);
      expect(configurado.uri).toMatch(/^otpauth:\/\/totp\/FARO:/);
      expect(configurado.uri).toContain('issuer=FARO');
      const secreto = secretoDeUri(configurado.uri);
      expect(configurado.claveManual.replace(/ /g, '')).toBe(secreto);

      const fila = await filaUsuario(u.idUsuario);
      expect(fila.totpSecreto).toMatch(/^v1:/);
      expect(fila.totpSecreto).not.toContain(secreto);
      expect(fila.totpActivo).toBe(false);
    });

    it('flujo completo: el primer código activa, da 10 códigos y abre la sesión', async () => {
      const { u, tokenTemporal, secreto } = await adminConfigurando();
      const antes = await filaUsuario(u.idUsuario);

      const { body } = await verificar(
        tokenTemporal,
        await codigoTotp(secreto),
      ).expect(200);
      expect(body.estado).toBe('OK');
      expect(body.usuario.negocio).toBeNull();
      expect(body.codigosRespaldo).toHaveLength(10);
      for (const codigo of body.codigosRespaldo as string[]) {
        expect(codigo).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);
      }
      const contexto = await yo(body.token).expect(200);
      expect(contexto.body.idNegocio).toBeNull();

      const despues = await filaUsuario(u.idUsuario);
      expect(despues.totpActivo).toBe(true);
      expect(despues.totpUltimoPaso).not.toBeNull();
      expect(despues.versionSesion).toBe(antes.versionSesion + 1);
      const hashes = await dataSource.query<{ hash: string }[]>(
        `SELECT hash FROM usuario_codigo_respaldo WHERE id_usuario = $1`,
        [u.idUsuario],
      );
      expect(hashes).toHaveLength(10);
      for (const { hash } of hashes) {
        expect(hash).toMatch(/^\$2b\$12\$/);
        for (const codigo of body.codigosRespaldo as string[]) {
          expect(hash).not.toContain(codigo.replace('-', ''));
        }
      }
      // version_sesion subió: el token temporal usado ya no sirve.
      await configurar(tokenTemporal).expect(401);
      await verificar(tokenTemporal, await codigoTotp(secreto)).expect(401);
    });

    it('configurar dos veces reemplaza el secreto: el código del primero falla', async () => {
      const { tokenTemporal, secreto } = await adminConfigurando();
      const segundo = await configurar(tokenTemporal).expect(200);
      expect(secretoDeUri(segundo.body.uri)).not.toBe(secreto);
      const r = await verificar(tokenTemporal, await codigoTotp(secreto));
      expect(r.status).toBe(401);
      expect(r.body).toEqual(CREDENCIALES_INVALIDAS);
      await verificar(
        tokenTemporal,
        await codigoTotp(secretoDeUri(segundo.body.uri)),
      ).expect(200);
    });

    it('con la 2FA activa, configurar → 409', async () => {
      const { u } = await adminConDosFactores();
      await configurar(await tokenVerificar(u)).expect(409);
    });
  });

  describe('verificación y antirreúso', () => {
    it('un paso ya usado se rechaza (CODIGO_REUSADO); el siguiente entra', async () => {
      const { u, secreto } = await adminConDosFactores();
      const usado = (await filaUsuario(u.idUsuario)).totpUltimoPaso as number;
      const token = await tokenVerificar(u);

      const reusado = await verificar(
        token,
        await codigoTotp(secreto, usado * 30),
      ).expect(401);
      expect(reusado.body).toEqual(CREDENCIALES_INVALIDAS);
      const eventos = await bitacoraDe(u.idUsuario);
      expect(eventos.at(-1)).toMatchObject({
        evento: 'VERIFICACION_2FA_FALLIDA',
        detalle: { motivo: 'CODIGO_REUSADO', intentos: 1 },
      });

      const { body } = await verificar(
        token,
        await codigoTotp(secreto, (usado + 1) * 30),
      ).expect(200);
      expect(body.estado).toBe('OK');
      expect(body).not.toHaveProperty('codigosRespaldo');
      await yo(body.token).expect(200);
      const fila = await filaUsuario(u.idUsuario);
      expect(fila.totpUltimoPaso).toBe(usado + 1);
      expect(fila.intentosFallidos).toBe(0);
    });

    it('el mismo código en dos peticiones a la vez: solo una entra', async () => {
      const { u, secreto } = await adminConDosFactores();
      const usado = (await filaUsuario(u.idUsuario)).totpUltimoPaso as number;
      const [t1, t2] = [await tokenVerificar(u), await tokenVerificar(u)];
      const codigo = await codigoTotp(secreto, (usado + 1) * 30);
      const estados = (
        await Promise.all([verificar(t1, codigo), verificar(t2, codigo)])
      ).map((r) => r.status);
      expect(estados.sort()).toEqual([200, 401]);
    });

    it('dueño sin 2FA entra con OK; con 2FA activa le pide el código', async () => {
      const dueno = await crearUsuarioDePrueba(dataSource, { negocio });
      const { body } = await login(dueno).expect(200);
      expect(body.estado).toBe('OK');
      expect(body.token).toEqual(expect.any(String));

      const secreto = generarSecretoTotp();
      await dataSource.query(
        `UPDATE usuario SET totp_secreto = $1, totp_activo = true WHERE id_usuario = $2`,
        [
          app.get(CifradoTotpService).cifrar(secreto, dueno.idUsuario),
          dueno.idUsuario,
        ],
      );
      const token = await tokenVerificar(dueno);
      const { body: sesion } = await verificar(
        token,
        await codigoTotp(secreto),
      ).expect(200);
      expect(sesion.usuario.negocio).toEqual({
        id: negocio.idNegocio,
        nombre: 'Tienda 2FA',
      });
    });

    it('usuario dado de baja entre el login y verificar → 401', async () => {
      const { u, secreto } = await adminConDosFactores();
      const token = await tokenVerificar(u);
      await dataSource.query(
        `UPDATE usuario SET id_estado = 0 WHERE id_usuario = $1`,
        [u.idUsuario],
      );
      await verificar(token, await codigoTotp(secreto)).expect(401);
    });
  });

  describe('el token temporal solo sirve en /auth/2fa/*', () => {
    it('no sirve en otras rutas, y el de sesión no sirve en la 2FA', async () => {
      const { u, secreto } = await adminConDosFactores();
      const temporal = await tokenVerificar(u);
      await yo(temporal).expect(401);
      await http()
        .post('/api/auth/cambiar-clave')
        .set(conToken(temporal))
        .send({ claveActual: u.clave, claveNueva: 'otra-clave-larga-1' })
        .expect(401);

      const { body } = await verificar(
        temporal,
        await codigoTotp(
          secreto,
          (((await filaUsuario(u.idUsuario)).totpUltimoPaso as number) + 1) *
            30,
        ),
      ).expect(200);
      await configurar(body.token).expect(401);
      await verificar(body.token, '123456').expect(401);
      await http().post('/api/auth/2fa/configurar').expect(401);
    });

    it('vencido o con otro propósito → 401', async () => {
      const { u } = await adminConDosFactores();
      const { versionSesion } = await filaUsuario(u.idUsuario);
      const jwt = app.get(JwtService);
      const payload = { idUsuario: u.idUsuario, versionSesion };
      await verificar(
        jwt.sign({ ...payload, proposito: '2fa' }, { expiresIn: -10 }),
        '123456',
      ).expect(401);
      await verificar(
        jwt.sign({ ...payload, proposito: 'otro' }),
        '123456',
      ).expect(401);
      // El mismo payload, vigente y con proposito 2fa, sí llega a verificar.
      const r = await verificar(
        jwt.sign({ ...payload, proposito: '2fa' }),
        '000000',
      );
      expect(r.body).toEqual(CREDENCIALES_INVALIDAS);
    });
  });

  describe('códigos de respaldo', () => {
    it('un código sirve una sola vez', async () => {
      const { u, codigos } = await adminConDosFactores();
      const { body } = await verificar(
        await tokenVerificar(u),
        codigos[0].toLowerCase(),
      ).expect(200);
      await yo(body.token).expect(200);
      const eventos = await bitacoraDe(u.idUsuario);
      expect(eventos.at(-1)).toMatchObject({
        evento: 'LOGIN_OK',
        detalle: { metodo: 'RESPALDO', restantes: 9 },
      });

      const otraVez = await verificar(await tokenVerificar(u), codigos[0]);
      expect(otraVez.status).toBe(401);
      expect(otraVez.body).toEqual(CREDENCIALES_INVALIDAS);
      await verificar(await tokenVerificar(u), codigos[1]).expect(200);
    });

    it('el mismo código en dos peticiones a la vez: solo una entra', async () => {
      const { u, codigos } = await adminConDosFactores();
      const [t1, t2] = [await tokenVerificar(u), await tokenVerificar(u)];
      const estados = (
        await Promise.all([
          verificar(t1, codigos[2]),
          verificar(t2, codigos[2]),
        ])
      ).map((r) => r.status);
      expect(estados.sort()).toEqual([200, 401]);
    });
  });

  describe('bloqueo (fallos de clave y de código suman juntos)', () => {
    it('3 claves malas + 2 códigos malos bloquean; luego ni el código bueno entra', async () => {
      const { u, secreto } = await adminConDosFactores();
      for (let i = 0; i < 3; i++) {
        await login({ ...u, clave: 'clave-mala-123' }).expect(401);
      }
      // La clave correcta con 2FA pendiente no reinicia el contador.
      const token = await tokenVerificar(u);
      expect((await filaUsuario(u.idUsuario)).intentosFallidos).toBe(3);
      await verificar(token, '000000').expect(401);
      await verificar(token, 'AAAAA-AAAAA').expect(401);

      const fila = await filaUsuario(u.idUsuario);
      expect(fila.bloqueadoHasta).not.toBeNull();
      const usado = fila.totpUltimoPaso as number;
      const r = await verificar(
        token,
        await codigoTotp(secreto, (usado + 1) * 30),
      );
      expect(r.status).toBe(401);
      expect(r.body).toEqual(CREDENCIALES_INVALIDAS);
      await login(u).expect(401);
      const eventos = (await bitacoraDe(u.idUsuario)).map((e) => e.evento);
      expect(eventos).toContain('BLOQUEO_CUENTA');
    });
  });

  describe('bitácora', () => {
    it('registra el enrolamiento con IP y nunca guarda secreto, URI, códigos ni tokens', async () => {
      const { u, tokenTemporal, secreto, configurado } =
        await adminConfigurando();
      const codigo = await codigoTotp(secreto);
      const { body } = await verificar(tokenTemporal, codigo).expect(200);

      const filas = await bitacoraDe(u.idUsuario);
      expect(filas.map((f) => f.evento)).toEqual([
        'LOGIN_2FA_PENDIENTE',
        'CONFIGURAR_2FA',
        'ACTIVACION_2FA',
      ]);
      for (const fila of filas) expect(fila.ip).not.toBeNull();

      const todo = JSON.stringify(
        await dataSource.query(`SELECT * FROM bitacora`),
      );
      for (const prohibido of [
        secreto,
        configurado.uri,
        codigo,
        tokenTemporal.split('.')[2],
        body.token.split('.')[2],
        ...(body.codigosRespaldo as string[]),
      ]) {
        expect(todo).not.toContain(prohibido);
      }
    });
  });
});
