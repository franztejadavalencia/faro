import { join } from 'path';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { ZONA_HORARIA } from '@common/utils/date.utils';
import { VariablesEntorno } from '../config/env.validation';

type VariablesBaseDatos = Pick<
  VariablesEntorno,
  'DB_HOST' | 'DB_PORT' | 'DB_NAME' | 'DB_USER' | 'DB_PASSWORD'
>;

/**
 * Opciones de conexión únicas para la app (`TypeOrmModule`) y para la CLI de
 * migraciones (`data-source.ts`), para que nunca diverjan.
 */
export function opcionesTypeOrm(
  variables: VariablesBaseDatos,
): PostgresConnectionOptions {
  // En `src/` (ts-node) las migraciones son .ts; en `dist/` son .js (sin los .d.ts).
  const extension = __filename.endsWith('.ts') ? 'ts' : 'js';
  return {
    type: 'postgres',
    host: variables.DB_HOST,
    port: variables.DB_PORT,
    database: variables.DB_NAME,
    username: variables.DB_USER,
    password: variables.DB_PASSWORD,
    applicationName: 'FARO',
    // El esquema solo cambia con migraciones (decisión 27).
    synchronize: false,
    migrationsRun: false,
    migrations: [join(__dirname, 'migrations', `*.${extension}`)],
    extra: {
      options: `-c timezone=${ZONA_HORARIA}`,
    },
  };
}
