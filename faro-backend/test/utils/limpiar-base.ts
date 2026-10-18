import { DataSource } from 'typeorm';
import { asegurarRolPlataforma } from '../../src/seguridad/permiso/utils/roles-iniciales';
import { asegurarBaseDePrueba } from './base-de-prueba';

/** Catálogo sembrado por migración (decisión 45): no se vacía entre suites. */
export const TABLAS_DE_CATALOGO = [
  'modulo_sistema',
  'opcion_modulo_sistema',
  'modulo_opcion_sistema',
];

/**
 * Vacía todas las tablas de `public` salvo la de migraciones y el catálogo de
 * permisos (`TABLAS_DE_CATALOGO`); el rol de plataforma, que el `TRUNCATE
 * negocio CASCADE` arrastra, se repone al final. `TRUNCATE` no
 * dispara los triggers de fila (inmutabilidad de asientos y bitácora). Cada
 * suite e2e lo llama en `beforeAll`.
 */
export async function limpiarBase(dataSource: DataSource): Promise<void> {
  const [{ current_database: nombreBase }] = await dataSource.query<
    { current_database: string }[]
  >('SELECT current_database()');
  asegurarBaseDePrueba(nombreBase);

  const tablaMigraciones =
    dataSource.options.migrationsTableName ?? 'migrations';
  const filas = await dataSource.query<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> $1 AND tablename <> ALL($2)`,
    [tablaMigraciones, TABLAS_DE_CATALOGO],
  );
  if (filas.length > 0) {
    const tablas = filas.map((f) => `"public"."${f.tablename}"`).join(', ');
    await dataSource.query(`TRUNCATE ${tablas} RESTART IDENTITY CASCADE`);
  }
  await asegurarRolPlataforma(dataSource.manager);
}
