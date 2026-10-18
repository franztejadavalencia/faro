import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { Negocio } from '../src/plataforma/entities/negocio.entity';
import { UsuarioCodigoRespaldo } from '../src/seguridad/entities/usuario-codigo-respaldo.entity';
import { Usuario } from '../src/seguridad/entities/usuario.entity';
import { crearApp } from './utils/crear-app';
import { limpiarBase } from './utils/limpiar-base';
import { codigoTotp, secretoDeUri } from './utils/totp-de-prueba';
import {
  crearNegocioDePrueba,
  crearUsuarioDePrueba,
  UsuarioDePrueba,
} from './utils/usuarios-de-prueba';

interface FilaBitacora {
  evento: string;
  detalle: Record<string, unknown> | null;
}

/**
 * 2FA opcional del dueño, con sesión (B7, decisiones 97 y 103). Los códigos se
 * generan con `@otplib/totp`, como la app del usuario, con la hora real.
 */
describe('2FA del dueño con sesión (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let secuencia = 0;

  const http = () => request(app.getHttpServer());
  const en = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = (u: UsuarioDePrueba) =>
    http().post('/api/auth/login').send({ usuario: u.usuario, clave: u.clave });
  const tokenDe = async (u: UsuarioDePrueba): Promise<string> =>
    (await login(u).expect(200)).body.token as string;
  const cuenta = (
    token: string,
    metodo: 'get' | 'post',
    ruta: string,
    cuerpo?: Record<string, unknown>,
  ) => {
    const r = http()[metodo](`/api/cuenta/2fa${ruta}`).set(en(token));
    return cuerpo ? r.send(cuerpo) : r;
  };
  const fila = (idUsuario: number) =>
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
  const bitacora = (idUsuario: number) =>
    dataSource.query<FilaBitacora[]>(
      `SELECT evento, detalle FROM bitacora WHERE id_usuario = $1 ORDER BY id_bitacora`,
      [idUsuario],
    );

  /** Un dueño en su propio negocio: cada prueba lleva el suyo y no comparte contadores. */
  async function nuevoDueno(): Promise<{ u: UsuarioDePrueba; token: string }> {
    secuencia += 1;
    const negocio: Negocio = await crearNegocioDePrueba(
      dataSource,
      `Tienda ${secuencia}`,
    );
    const u = await crearUsuarioDePrueba(dataSource, { negocio });
    return { u, token: await tokenDe(u) };
  }

  /** Configura y activa la 2FA por la API; devuelve lo que el dueño tendría. */
  async function activarLa2fa(u: UsuarioDePrueba, token: string) {
    const config = await cuenta(token, 'post', '/configurar', {
      clave: u.clave,
    }).expect(200);
    const secreto = secretoDeUri(config.body.uri as string);
    const activada = await cuenta(token, 'post', '/activar', {
      codigo: await codigoTotp(secreto),
    }).expect(200);
    return {
      secreto,
      token: activada.body.token as string,
      codigos: activada.body.codigosRespaldo as string[],
      paso: (await fila(u.idUsuario)).totpUltimoPaso as number,
    };
  }

  /** Un código TOTP válido y de un paso posterior al último aceptado. */
  const codigoSiguiente = (secreto: string, paso: number) =>
    codigoTotp(secreto, (paso + 1) * 30);

  beforeAll(async () => {
    app = await crearApp();
    dataSource = app.get(DataSource);
    await limpiarBase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('activar', () => {
    it('configurar (con la clave) y activar: sube la versión, mata el token viejo y el próximo login pide VERIFICAR_2FA', async () => {
      const { u, token } = await nuevoDueno();
      expect((await cuenta(token, 'get', '').expect(200)).body).toEqual({
        activo: false,
        codigosRespaldoRestantes: 0,
      });
      const antes = await fila(u.idUsuario);

      const config = await cuenta(token, 'post', '/configurar', {
        clave: u.clave,
      }).expect(200);
      expect(config.body.qr).toMatch(/^data:image\/png;base64,/);
      expect(config.body.uri).toContain('issuer=FARO');
      const secreto = secretoDeUri(config.body.uri as string);
      const pendiente = await fila(u.idUsuario);
      expect(pendiente.totpActivo).toBe(false);
      expect(pendiente.totpSecreto).toMatch(/^v1:/);
      expect(pendiente.totpSecreto).not.toContain(secreto);
      // Mientras esté pendiente, el login sigue siendo normal.
      expect((await login(u).expect(200)).body.estado).toBe('OK');

      const activada = await cuenta(token, 'post', '/activar', {
        codigo: await codigoTotp(secreto),
      }).expect(200);
      expect(activada.body.estado).toBe('OK');
      expect(activada.body.codigosRespaldo).toHaveLength(10);
      expect(activada.body.usuario.rol).toBe('Dueño');

      const despues = await fila(u.idUsuario);
      expect(despues.totpActivo).toBe(true);
      expect(despues.versionSesion).toBe(antes.versionSesion + 1);
      expect(
        await dataSource
          .getRepository(UsuarioCodigoRespaldo)
          .countBy({ idUsuario: u.idUsuario }),
      ).toBe(10);

      // El token de antes murió y el nuevo sirve.
      await cuenta(token, 'get', '').expect(401);
      const estado = await cuenta(activada.body.token, 'get', '').expect(200);
      expect(estado.body).toEqual({
        activo: true,
        codigosRespaldoRestantes: 10,
      });

      // El próximo login pide el segundo factor.
      const siguiente = await login(u).expect(200);
      expect(siguiente.body.estado).toBe('VERIFICAR_2FA');
      expect(siguiente.body.token).toBeUndefined();

      const eventos = (await bitacora(u.idUsuario)).map((e) => e.evento);
      expect(eventos).toEqual(
        expect.arrayContaining(['CONFIGURAR_2FA', 'ACTIVACION_2FA']),
      );
    });

    it('configurar con una clave incorrecta es 400, suma al bloqueo y no genera secreto', async () => {
      const { u, token } = await nuevoDueno();
      const { body } = await cuenta(token, 'post', '/configurar', {
        clave: 'clave-equivocada',
      }).expect(400);
      expect(body.message).toBe('La clave no es correcta.');
      const f = await fila(u.idUsuario);
      expect(f.totpSecreto).toBeNull();
      expect(f.intentosFallidos).toBe(1);
      const fallo = (await bitacora(u.idUsuario)).find(
        (e) => e.evento === 'VERIFICACION_2FA_FALLIDA',
      );
      expect(fallo?.detalle).toMatchObject({ motivo: 'CLAVE_INCORRECTA' });
      // La sesión sigue abierta: un 400 no la cierra.
      await cuenta(token, 'get', '').expect(200);
    });

    it('activar con un código incorrecto es 400 y suma; sin configurar antes, 400', async () => {
      const { u, token } = await nuevoDueno();
      const sinConfigurar = await cuenta(token, 'post', '/activar', {
        codigo: '123456',
      }).expect(400);
      expect(sinConfigurar.body.message).toMatch(/Primero configure/);

      await cuenta(token, 'post', '/configurar', { clave: u.clave }).expect(
        200,
      );
      await cuenta(token, 'post', '/activar', { codigo: '000000' }).expect(400);
      await cuenta(token, 'post', '/activar', { codigo: 'ABCDE-FGHIJ' }).expect(
        400,
      );
      const f = await fila(u.idUsuario);
      expect(f.totpActivo).toBe(false);
      expect(f.intentosFallidos).toBe(2);
    });

    it('configurar dos veces reemplaza el secreto pendiente: el primero ya no activa', async () => {
      const { u, token } = await nuevoDueno();
      const uno = await cuenta(token, 'post', '/configurar', {
        clave: u.clave,
      }).expect(200);
      const dos = await cuenta(token, 'post', '/configurar', {
        clave: u.clave,
      }).expect(200);
      await cuenta(token, 'post', '/activar', {
        codigo: await codigoTotp(secretoDeUri(uno.body.uri as string)),
      }).expect(400);
      await cuenta(token, 'post', '/activar', {
        codigo: await codigoTotp(secretoDeUri(dos.body.uri as string)),
      }).expect(200);
    });

    it('con la 2FA ya activa, configurar y activar son 409', async () => {
      const { u, token } = await nuevoDueno();
      const activa = await activarLa2fa(u, token);
      await cuenta(activa.token, 'post', '/configurar', {
        clave: u.clave,
      }).expect(409);
      await cuenta(activa.token, 'post', '/activar', {
        codigo: await codigoSiguiente(activa.secreto, activa.paso),
      }).expect(409);
    });
  });

  describe('desactivar (clave + código)', () => {
    it('con ambos correctos apaga la 2FA, sube la versión y el login vuelve a OK', async () => {
      const { u, token } = await nuevoDueno();
      const activa = await activarLa2fa(u, token);
      const antes = await fila(u.idUsuario);

      const { body } = await cuenta(activa.token, 'post', '/desactivar', {
        clave: u.clave,
        codigo: await codigoSiguiente(activa.secreto, activa.paso),
      }).expect(200);
      expect(body.estado).toBe('OK');

      const despues = await fila(u.idUsuario);
      expect(despues.totpActivo).toBe(false);
      expect(despues.totpSecreto).toBeNull();
      expect(despues.versionSesion).toBe(antes.versionSesion + 1);
      expect(
        await dataSource
          .getRepository(UsuarioCodigoRespaldo)
          .countBy({ idUsuario: u.idUsuario }),
      ).toBe(0);
      await cuenta(activa.token, 'get', '').expect(401);
      await cuenta(body.token, 'get', '').expect(200);
      expect((await login(u).expect(200)).body.estado).toBe('OK');

      const evento = (await bitacora(u.idUsuario)).find(
        (e) => e.evento === 'DESACTIVACION_2FA',
      );
      expect(evento?.detalle).toEqual({ metodo: 'TOTP' });
    });

    it('con la clave o el código incorrectos se rechaza (400), suma al bloqueo y la 2FA sigue activa', async () => {
      const { u, token } = await nuevoDueno();
      const activa = await activarLa2fa(u, token);
      const codigo = await codigoSiguiente(activa.secreto, activa.paso);

      await cuenta(activa.token, 'post', '/desactivar', {
        clave: 'clave-equivocada',
        codigo,
      }).expect(400);
      await cuenta(activa.token, 'post', '/desactivar', {
        clave: u.clave,
        codigo: '000000',
      }).expect(400);
      await cuenta(activa.token, 'post', '/desactivar', {
        clave: u.clave,
        codigo: 'ZZZZZ-ZZZZZ',
      }).expect(400);

      const f = await fila(u.idUsuario);
      expect(f.totpActivo).toBe(true);
      expect(f.intentosFallidos).toBe(3);
      // La clave se probó primero: con la clave mala el código bueno no se gastó.
      await cuenta(activa.token, 'post', '/desactivar', {
        clave: u.clave,
        codigo,
      }).expect(200);

      const motivos = (await bitacora(u.idUsuario))
        .filter((e) => e.evento === 'VERIFICACION_2FA_FALLIDA')
        .map((e) => e.detalle?.motivo);
      expect(motivos).toEqual([
        'CLAVE_INCORRECTA',
        'CODIGO_INCORRECTO',
        'CODIGO_INCORRECTO',
      ]);
    });

    it('un código de un paso ya usado se rechaza', async () => {
      const { u, token } = await nuevoDueno();
      const activa = await activarLa2fa(u, token);
      // El paso de la activación ya se aceptó.
      await cuenta(activa.token, 'post', '/desactivar', {
        clave: u.clave,
        codigo: await codigoTotp(activa.secreto, activa.paso * 30),
      }).expect(400);
      const reusado = (await bitacora(u.idUsuario)).find(
        (e) => e.detalle?.motivo === 'CODIGO_REUSADO',
      );
      expect(reusado).toBeDefined();
      expect((await fila(u.idUsuario)).totpActivo).toBe(true);
    });

    it('también sirve un código de respaldo, que se gasta', async () => {
      const { u, token } = await nuevoDueno();
      const activa = await activarLa2fa(u, token);
      await cuenta(activa.token, 'post', '/desactivar', {
        clave: u.clave,
        codigo: activa.codigos[0],
      }).expect(200);
      const evento = (await bitacora(u.idUsuario)).find(
        (e) => e.evento === 'DESACTIVACION_2FA',
      );
      expect(evento?.detalle).toMatchObject({ metodo: 'RESPALDO' });
    });

    it('sin la 2FA activa es 409', async () => {
      const { u, token } = await nuevoDueno();
      await cuenta(token, 'post', '/desactivar', {
        clave: u.clave,
        codigo: '123456',
      }).expect(409);
      await cuenta(token, 'post', '/codigos-respaldo', {
        clave: u.clave,
        codigo: '123456',
      }).expect(409);
    });
  });

  describe('regenerar los códigos de respaldo', () => {
    it('pide clave + código, entrega 10 nuevos, invalida los anteriores y no corta la sesión', async () => {
      const { u, token } = await nuevoDueno();
      const activa = await activarLa2fa(u, token);
      const antes = await fila(u.idUsuario);

      await cuenta(activa.token, 'post', '/codigos-respaldo', {
        clave: 'clave-equivocada',
        codigo: await codigoSiguiente(activa.secreto, activa.paso),
      }).expect(400);
      const { body } = await cuenta(activa.token, 'post', '/codigos-respaldo', {
        clave: u.clave,
        codigo: await codigoSiguiente(activa.secreto, activa.paso),
      }).expect(200);
      expect(body.codigosRespaldo).toHaveLength(10);
      expect(body.codigosRespaldo).not.toContain(activa.codigos[0]);
      expect((await fila(u.idUsuario)).versionSesion).toBe(antes.versionSesion);
      // La misma sesión sigue y hay 10 códigos sin usar.
      expect((await cuenta(activa.token, 'get', '').expect(200)).body).toEqual({
        activo: true,
        codigosRespaldoRestantes: 10,
      });

      // Un código viejo ya no sirve en el login; uno nuevo sí.
      const temporal = (await login(u).expect(200)).body
        .tokenTemporal as string;
      const verificar = (codigo: string) =>
        http()
          .post('/api/auth/2fa/verificar')
          .set(en(temporal))
          .send({ codigo });
      await verificar(activa.codigos[0]).expect(401);
      await verificar(body.codigosRespaldo[0]).expect(200);
    });
  });

  describe('quién puede usarla', () => {
    it('un empleado recibe 403 en todas las rutas', async () => {
      const { u } = await nuevoDueno();
      const negocio = { idNegocio: u.idNegocio } as Negocio;
      const empleado = await crearUsuarioDePrueba(dataSource, {
        negocio,
        rol: 'EMPLEADO',
      });
      const token = await tokenDe(empleado);
      const clave = { clave: empleado.clave, codigo: '123456' };
      await cuenta(token, 'get', '').expect(403);
      await cuenta(token, 'post', '/configurar', {
        clave: empleado.clave,
      }).expect(403);
      await cuenta(token, 'post', '/activar', { codigo: '123456' }).expect(403);
      await cuenta(token, 'post', '/desactivar', clave).expect(403);
      await cuenta(token, 'post', '/codigos-respaldo', clave).expect(403);
      expect((await fila(empleado.idUsuario)).totpSecreto).toBeNull();
    });

    it('el admin de plataforma recibe 403 y no puede desactivar la suya', async () => {
      const admin = await crearUsuarioDePrueba(dataSource, { negocio: null });
      // Su login pide enrolar: configura y verifica por las rutas del token temporal.
      const temporal = (await login(admin).expect(200)).body
        .tokenTemporal as string;
      const config = await http()
        .post('/api/auth/2fa/configurar')
        .set(en(temporal))
        .expect(200);
      const secreto = secretoDeUri(config.body.uri as string);
      const sesion = await http()
        .post('/api/auth/2fa/verificar')
        .set(en(temporal))
        .send({ codigo: await codigoTotp(secreto) })
        .expect(200);
      const token = sesion.body.token as string;
      const paso = (await fila(admin.idUsuario)).totpUltimoPaso as number;

      await cuenta(token, 'get', '').expect(403);
      const intento = await cuenta(token, 'post', '/desactivar', {
        clave: admin.clave,
        codigo: await codigoSiguiente(secreto, paso),
      }).expect(403);
      expect(intento.body.message).toMatch(/obligatoria/);
      await cuenta(token, 'post', '/configurar', { clave: admin.clave }).expect(
        403,
      );
      await cuenta(token, 'post', '/codigos-respaldo', {
        clave: admin.clave,
        codigo: '123456',
      }).expect(403);

      const f = await fila(admin.idUsuario);
      expect(f.totpActivo).toBe(true);
      expect((await login(admin).expect(200)).body.estado).toBe(
        'VERIFICAR_2FA',
      );
    });

    it('sin sesión es 401, y un token temporal de la 2FA no sirve aquí', async () => {
      await http().get('/api/cuenta/2fa').expect(401);
      const { u, token } = await nuevoDueno();
      const activa = await activarLa2fa(u, token);
      const temporal = (await login(u).expect(200)).body
        .tokenTemporal as string;
      await cuenta(temporal, 'get', '').expect(401);
      await cuenta(activa.token, 'get', '').expect(200);
    });
  });

  describe('bloqueo y bitácora', () => {
    it('5 fallos seguidos bloquean la cuenta (429 después, aun con datos correctos)', async () => {
      const { u, token } = await nuevoDueno();
      const activa = await activarLa2fa(u, token);
      for (let i = 0; i < 5; i += 1) {
        await cuenta(activa.token, 'post', '/desactivar', {
          clave: 'clave-equivocada',
          codigo: '000000',
        }).expect(400);
      }
      expect((await fila(u.idUsuario)).bloqueadoHasta).not.toBeNull();
      await cuenta(activa.token, 'post', '/desactivar', {
        clave: u.clave,
        codigo: await codigoSiguiente(activa.secreto, activa.paso),
      }).expect(429);
      await cuenta(activa.token, 'post', '/codigos-respaldo', {
        clave: u.clave,
        codigo: '000000',
      }).expect(429);
      expect((await fila(u.idUsuario)).totpActivo).toBe(true);
      await login(u).expect(401);
    });

    it('la bitácora no guarda secreto, uri, códigos, claves ni tokens', async () => {
      const { u, token } = await nuevoDueno();
      const activa = await activarLa2fa(u, token);
      await cuenta(activa.token, 'post', '/desactivar', {
        clave: 'clave-equivocada',
        codigo: activa.codigos[1],
      }).expect(400);
      await cuenta(activa.token, 'post', '/codigos-respaldo', {
        clave: u.clave,
        codigo: await codigoSiguiente(activa.secreto, activa.paso),
      }).expect(200);

      const texto = JSON.stringify(await bitacora(u.idUsuario));
      for (const secreto of [
        activa.secreto,
        u.clave,
        activa.token,
        activa.codigos[0],
        activa.codigos[1],
        'otpauth://',
      ]) {
        expect(texto).not.toContain(secreto);
      }
      expect(texto).toContain('CODIGOS_RESPALDO_REGENERADOS');
    });
  });
});
