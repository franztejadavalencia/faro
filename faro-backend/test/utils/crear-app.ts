import { ModuleMetadata } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configurarApp } from '../../src/configurar-app';

/**
 * Levanta la app completa, configurada igual que en `main.ts`. `extras` suma
 * módulos solo de prueba (controladores de apoyo del test).
 */
export async function crearApp(
  extras: ModuleMetadata['imports'] = [],
): Promise<NestExpressApplication> {
  const modulo = await Test.createTestingModule({
    imports: [AppModule, ...extras],
  }).compile();
  const app = modulo.createNestApplication<NestExpressApplication>();
  configurarApp(app);
  await app.init();
  return app;
}
