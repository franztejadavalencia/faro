import { DataSource } from 'typeorm';
import { asegurarBaseDePrueba } from './base-de-prueba';

/**
 * Vacía todas las tablas de `public` salvo la de migraciones. `TRUNCATE` no
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
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> $1`,
    [tablaMigraciones],
  );
  if (filas.length === 0) return;

  const tablas = filas.map((f) => `"public"."${f.tablename}"`).join(', ');
  await dataSource.query(`TRUNCATE ${tablas} RESTART IDENTITY CASCADE`);
}
