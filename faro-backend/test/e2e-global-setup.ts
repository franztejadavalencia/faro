// Los aliases (@common/…) de src/ se resuelven aquí con tsconfig-paths: el
// moduleNameMapper de jest no se aplica al globalSetup.
import 'tsconfig-paths/register';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { validarEntorno } from '../src/config/env.validation';
import { opcionesTypeOrm } from '../src/database/typeorm.config';
import { asegurarBaseDePrueba } from './utils/base-de-prueba';

/** Antes de todas las suites: verifica que la base sea de prueba y la migra. */
export default async function (): Promise<void> {
  config({ path: '.env.test' });
  const variables = validarEntorno(process.env);
  asegurarBaseDePrueba(variables.DB_NAME);

  const dataSource = new DataSource(opcionesTypeOrm(variables));
  await dataSource.initialize();
  try {
    await dataSource.runMigrations({ transaction: 'each' });
  } finally {
    await dataSource.destroy();
  }
}
