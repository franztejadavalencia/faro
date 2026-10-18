/**
 * Se intentó escribir una fila de otro negocio, o cambiar el negocio de una
 * fila. Es un bug (alguien no usó `NegocioRepository`), no un error del
 * usuario: el filtro global lo responde como 500 y deja el detalle en el log.
 */
export class NegocioIncorrectoError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'NegocioIncorrectoError';
  }
}
