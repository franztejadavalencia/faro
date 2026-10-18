import { ModuleMetadata } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configurarApp } from '../../src/configurar-app';
import { asegurarBaseDePrueba } from './base-de-prueba';

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
  // La app arma su conexión por `ConfigService`; el globalSetup verificó `DB_NAME`
  // por su cuenta. Se comprueba la base que usa esta app, la que vacía `limpiarBase()`.
  const base = app.get(DataSource).options.database;
  try {
    asegurarBaseDePrueba(typeof base === 'string' ? base : '');
  } catch (error) {
    await app.close();
    throw error;
  }
  return app;
}
