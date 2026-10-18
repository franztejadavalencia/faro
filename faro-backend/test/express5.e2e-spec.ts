import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import { crearApp } from './utils/crear-app';
import { ModuloExpress5 } from './utils/controlador-express5';

/**
 * Fija el comportamiento de Express 5 / Nest 11 (B2b, decisión 79) para las
 * tareas siguientes. Con `TRUST_PROXY` vacío (el de `.env.test`).
 */
describe('Express 5 (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearApp([ModuloExpress5]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('una ruta inexistente responde 404 con la forma de Nest', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/no-existe')
      .expect(404);
    expect(res.body).toEqual({
      statusCode: 404,
      message: 'Cannot GET /api/no-existe',
      error: 'Not Found',
    });
  });

  it('GET /api/salud responde 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/salud')
      .expect(200);
    expect(res.body).toEqual({ estado: 'ok', baseDatos: 'ok' });
  });

  it('GET /api/docs-json documenta /api/salud', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    expect(Object.keys(res.body.paths)).toContain('/api/salud');
  });

  describe('query parser (simple)', () => {
    it('un parámetro repetido llega como arreglo', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/prueba-express5/query?a=1&a=2')
        .expect(200);
      expect(res.body).toEqual({ a: ['1', '2'] });
    });

    it('los corchetes no construyen objetos ni arreglos', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/prueba-express5/query?a[b]=1&c[]=2')
        .expect(200);
      expect(res.body).toEqual({ 'a[b]': '1', 'c[]': '2' });
    });

    it('un filtro de lista normaliza un valor a arreglo', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/prueba-express5/filtro?estado=1')
        .expect(200);
      expect(res.body).toEqual({ estado: ['1'] });
    });

    it('un filtro de lista acepta dos valores', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/prueba-express5/filtro?estado=1&estado=2')
        .expect(200);
      expect(res.body).toEqual({ estado: ['1', '2'] });
    });

    it('la sintaxis estado[]=1 se rechaza (propiedad no permitida)', async () => {
      await request(app.getHttpServer())
        .get('/api/prueba-express5/filtro?estado[]=1')
        .expect(400);
    });
  });

  it('un comodín con nombre (*splat) captura el resto de la ruta', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/prueba-express5/archivos/a/b/c')
      .expect(200);
    expect(res.body).toEqual({ splat: ['a', 'b', 'c'] });
  });

  it('sin TRUST_PROXY se ignora x-forwarded-for (decisión 51)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/prueba-express5/ip')
      .set('X-Forwarded-For', '203.0.113.7')
      .expect(200);
    expect(res.body.ip).not.toContain('203.0.113.7');
  });
});
