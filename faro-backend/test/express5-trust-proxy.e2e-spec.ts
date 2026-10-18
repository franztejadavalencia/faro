// `ConfigModule` valida y fija las variables al importar `AppModule`: para probar
// `TRUST_PROXY` con valor hay que fijarlo antes de ese import, por eso este caso
// vive en su propio archivo (cada archivo e2e tiene su registro de módulos).
process.env.TRUST_PROXY = '1';

import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import { crearApp } from './utils/crear-app';
import { ModuloExpress5 } from './utils/controlador-express5';

describe('Express 5 con TRUST_PROXY=1 (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearApp([ModuloExpress5]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('con TRUST_PROXY se respeta x-forwarded-for (decisión 51)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/prueba-express5/ip')
      .set('X-Forwarded-For', '203.0.113.7')
      .expect(200);
    expect(res.body.ip).toBe('203.0.113.7');
  });
});
