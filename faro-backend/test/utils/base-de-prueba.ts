/**
 * Los e2e vacían tablas: nunca deben apuntar a `faro_dev` (architecture.md §2).
 * Se exige que la base termine en `_test`.
 */
export function asegurarBaseDePrueba(nombreBase: string): void {
  if (!nombreBase.endsWith('_test')) {
    throw new Error(
      `Los e2e solo corren sobre una base terminada en _test (DB_NAME=${nombreBase}). Revisa .env.test.`,
    );
  }
}
