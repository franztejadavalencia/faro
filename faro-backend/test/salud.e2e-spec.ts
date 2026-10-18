import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { crearApp } from './utils/crear-app';
import { limpiarBase } from './utils/limpiar-base';

describe('Humo (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearApp();
    await limpiarBase(app.get(DataSource));
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/salud responde 200 con la base conectada', () => {
    return request(app.getHttpServer())
      .get('/api/salud')
      .expect(200)
      .expect({ estado: 'ok', baseDatos: 'ok' });
  });

  it('la conexión apunta a una base de prueba', async () => {
    const [{ current_database: nombreBase }] = await app
      .get(DataSource)
      .query<{ current_database: string }[]>('SELECT current_database()');
    expect(nombreBase).toMatch(/_test$/);
  });

  it('Swagger publica el documento con la ruta de salud', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    expect(respuesta.body.paths).toHaveProperty('/api/salud');
  });
});
