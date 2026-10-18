import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { validarEntorno } from '../../config/env.validation';
import { opcionesTypeOrm } from '../typeorm.config';
import { sembrarAdminPlataforma } from './admin-plataforma.seed';

// Fuera de Nest no hay ConfigModule: este script carga el mismo `.env`.
config({ path: `.env.${process.env.NODE_ENV ?? 'development'}` });

/** `npm run seed:admin`: crea al admin de plataforma con ADMIN_* del `.env`. */
async function main(): Promise<void> {
  const variables = validarEntorno(process.env);
  const { ADMIN_USUARIO, ADMIN_CLAVE, ADMIN_NOMBRE } = variables;
  if (!ADMIN_USUARIO || !ADMIN_CLAVE || !ADMIN_NOMBRE) {
    throw new Error(
      'Faltan ADMIN_USUARIO, ADMIN_CLAVE o ADMIN_NOMBRE en el .env (ver .env.example).',
    );
  }

  const dataSource = new DataSource({
    ...opcionesTypeOrm(variables),
    entities: ['src/**/*.entity.ts'],
  });
  await dataSource.initialize();
  try {
    const resultado = await sembrarAdminPlataforma(dataSource, {
      usuario: ADMIN_USUARIO,
      clave: ADMIN_CLAVE,
      nombre: ADMIN_NOMBRE,
      debeCambiarClave: variables.NODE_ENV === 'production',
    });
    console.log(
      resultado === 'creado'
        ? `Admin de plataforma «${ADMIN_USUARIO}» creado en ${variables.DB_NAME}.`
        : `Ya existe «${ADMIN_USUARIO}» en ${variables.DB_NAME}: no se cambió nada ni su clave.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
