/**
 * Códigos de `modulo_sistema` (módulos hoja, con permisos). Estables: son lo que
 * escribe `@RequierePermiso(MODULOS.X, OPCIONES.Y)`; un código que no exista
 * aquí no compila. Un e2e los compara con el catálogo sembrado.
 */
export const MODULOS = {
  POS: 'pos',
  VENTAS: 'ventas',
  COMPRAS: 'compras',
  INVENTARIO: 'inventario',
  AJUSTES_INVENTARIO: 'ajustes_inventario',
  LINEAS: 'lineas',
  PRODUCTOS: 'productos',
  PROVEEDORES: 'proveedores',
  GASTOS: 'gastos',
  PLAN_CUENTAS: 'plan_cuentas',
  LIBRO_DIARIO: 'libro_diario',
  LIBRO_MAYOR: 'libro_mayor',
  CUADRE: 'cuadre',
  CIERRE_MENSUAL: 'cierre_mensual',
  ESTADO_RESULTADOS: 'estado_resultados',
  RANKING: 'ranking',
  DASHBOARD: 'dashboard',
  NEGOCIO: 'negocio',
  CATEGORIAS_GASTO: 'categorias_gasto',
  USUARIOS: 'usuarios',
  ROLES: 'roles',
  BITACORA: 'bitacora',
  NEGOCIOS: 'negocios',
  BITACORA_PLATAFORMA: 'bitacora_plataforma',
} as const;

export type CodigoModulo = (typeof MODULOS)[keyof typeof MODULOS];
