export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Código SQLSTATE de un error de Postgres (`QueryFailedError.driverError.code`),
 * o `undefined` si el error no viene del driver.
 */
export function getPgErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const candidate =
    'driverError' in error &&
    typeof error.driverError === 'object' &&
    error.driverError !== null
      ? error.driverError
      : error;

  if (!('code' in candidate)) return undefined;

  return typeof candidate.code === 'string' ? candidate.code : undefined;
}
