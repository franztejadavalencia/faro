/** Códigos de `opcion_modulo_sistema` (decisión 49). Estables: los usa el código. */
export const OPCIONES = {
  VER: 'ver',
  CREAR: 'crear',
  EDITAR: 'editar',
  ELIMINAR: 'eliminar',
  ANULAR: 'anular',
  CERRAR: 'cerrar',
  REABRIR: 'reabrir',
  VER_COSTOS: 'ver_costos',
} as const;

export type CodigoOpcion = (typeof OPCIONES)[keyof typeof OPCIONES];
