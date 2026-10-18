import { CodigoModulo, MODULOS } from './modulos';
import { CodigoOpcion, OPCIONES } from './opciones';

const { VER, CREAR, EDITAR, ELIMINAR, ANULAR, CERRAR, REABRIR, VER_COSTOS } =
  OPCIONES;

export const AMBITOS = ['NEGOCIO', 'PLATAFORMA'] as const;
export type Ambito = (typeof AMBITOS)[number];

export interface GrupoCatalogo {
  codigo: string;
  nombre: string;
  icono: string;
  orden: number;
  ambito: Ambito;
}

export interface ModuloCatalogo {
  codigo: CodigoModulo;
  nombre: string;
  descripcion: string;
  route: string;
  icono: string;
  orden: number;
  /** Código del grupo del menú; `null` = nivel superior. */
  grupo: string | null;
  ambito: Ambito;
  /** Pares válidos del módulo (`modulo_opcion_sistema`). */
  opciones: readonly CodigoOpcion[];
}

/**
 * Catálogo de referencia del código y de los tests. La migración
 * `Permisos1792291005000` lleva su propia copia (una migración es una foto fija);
 * `test/permisos.e2e-spec.ts` comprueba que ambas coinciden. Un módulo nuevo se
 * agrega aquí, en `MODULOS` y en **su propia migración**, que llama a
 * `otorgarARolesFijos` (decisión 99).
 */
export const OPCIONES_CATALOGO: readonly {
  codigo: CodigoOpcion;
  nombre: string;
  orden: number;
}[] = [
  { codigo: VER, nombre: 'Ver', orden: 1 },
  { codigo: CREAR, nombre: 'Crear', orden: 2 },
  { codigo: EDITAR, nombre: 'Editar', orden: 3 },
  { codigo: ELIMINAR, nombre: 'Eliminar', orden: 4 },
  { codigo: ANULAR, nombre: 'Anular', orden: 5 },
  { codigo: CERRAR, nombre: 'Cerrar mes', orden: 6 },
  { codigo: REABRIR, nombre: 'Reabrir mes', orden: 7 },
  { codigo: VER_COSTOS, nombre: 'Ver costos', orden: 8 },
];

export const GRUPOS_CATALOGO: readonly GrupoCatalogo[] = [
  {
    codigo: 'g_ventas',
    nombre: 'Ventas',
    icono: 'point_of_sale',
    orden: 10,
    ambito: 'NEGOCIO',
  },
  {
    codigo: 'g_inventario',
    nombre: 'Inventario',
    icono: 'inventory_2',
    orden: 20,
    ambito: 'NEGOCIO',
  },
  {
    codigo: 'g_catalogo',
    nombre: 'Catálogo',
    icono: 'category',
    orden: 30,
    ambito: 'NEGOCIO',
  },
  {
    codigo: 'g_contabilidad',
    nombre: 'Contabilidad',
    icono: 'account_balance',
    orden: 50,
    ambito: 'NEGOCIO',
  },
  {
    codigo: 'g_analisis',
    nombre: 'Análisis',
    icono: 'insights',
    orden: 70,
    ambito: 'NEGOCIO',
  },
  {
    codigo: 'g_configuracion',
    nombre: 'Configuración',
    icono: 'settings',
    orden: 80,
    ambito: 'NEGOCIO',
  },
  {
    codigo: 'g_seguridad',
    nombre: 'Seguridad',
    icono: 'shield',
    orden: 90,
    ambito: 'NEGOCIO',
  },
  {
    codigo: 'g_plataforma',
    nombre: 'Plataforma',
    icono: 'domain',
    orden: 100,
    ambito: 'PLATAFORMA',
  },
];

const N = 'NEGOCIO';
const P = 'PLATAFORMA';

export const MODULOS_CATALOGO: readonly ModuloCatalogo[] = [
  {
    codigo: MODULOS.POS,
    nombre: 'Punto de venta',
    descripcion: 'Vender en caja y emitir el comprobante',
    route: '/pos',
    icono: 'point_of_sale',
    orden: 1,
    grupo: 'g_ventas',
    ambito: N,
    opciones: [VER, CREAR],
  },
  {
    codigo: MODULOS.VENTAS,
    nombre: 'Ventas',
    descripcion: 'Listado, registro manual y anulación de ventas',
    route: '/ventas',
    icono: 'receipt_long',
    orden: 2,
    grupo: 'g_ventas',
    ambito: N,
    opciones: [VER, CREAR, ANULAR, VER_COSTOS],
  },
  {
    codigo: MODULOS.COMPRAS,
    nombre: 'Compras',
    descripcion: 'Compras a proveedores y su anulación',
    route: '/compras',
    icono: 'shopping_cart',
    orden: 1,
    grupo: 'g_inventario',
    ambito: N,
    opciones: [VER, CREAR, ANULAR, VER_COSTOS],
  },
  {
    codigo: MODULOS.INVENTARIO,
    nombre: 'Stock y kardex',
    descripcion: 'Existencias valoradas y kardex por producto',
    route: '/inventario',
    icono: 'warehouse',
    orden: 2,
    grupo: 'g_inventario',
    ambito: N,
    opciones: [VER, VER_COSTOS],
  },
  {
    codigo: MODULOS.AJUSTES_INVENTARIO,
    nombre: 'Ajustes de inventario',
    descripcion: 'Inventario inicial, mermas y conteos',
    route: '/ajustes-inventario',
    icono: 'tune',
    orden: 3,
    grupo: 'g_inventario',
    ambito: N,
    opciones: [VER, CREAR, ANULAR, VER_COSTOS],
  },
  {
    codigo: MODULOS.LINEAS,
    nombre: 'Líneas',
    descripcion: 'Categorías de productos',
    route: '/lineas',
    icono: 'label',
    orden: 1,
    grupo: 'g_catalogo',
    ambito: N,
    opciones: [VER, CREAR, EDITAR, ELIMINAR],
  },
  {
    codigo: MODULOS.PRODUCTOS,
    nombre: 'Productos',
    descripcion: 'Catálogo de productos',
    route: '/productos',
    icono: 'package_2',
    orden: 2,
    grupo: 'g_catalogo',
    ambito: N,
    opciones: [VER, CREAR, EDITAR, ELIMINAR, VER_COSTOS],
  },
  {
    codigo: MODULOS.PROVEEDORES,
    nombre: 'Proveedores',
    descripcion: 'Proveedores del negocio',
    route: '/proveedores',
    icono: 'local_shipping',
    orden: 3,
    grupo: 'g_catalogo',
    ambito: N,
    opciones: [VER, CREAR, EDITAR, ELIMINAR],
  },
  {
    codigo: MODULOS.GASTOS,
    nombre: 'Gastos',
    descripcion: 'Gastos indirectos del mes',
    route: '/gastos',
    icono: 'payments',
    orden: 40,
    grupo: null,
    ambito: N,
    opciones: [VER, CREAR, ANULAR],
  },
  {
    codigo: MODULOS.PLAN_CUENTAS,
    nombre: 'Plan de cuentas',
    descripcion: 'Cuentas contables del negocio',
    route: '/contabilidad/plan-cuentas',
    icono: 'list_alt',
    orden: 1,
    grupo: 'g_contabilidad',
    ambito: N,
    opciones: [VER],
  },
  {
    codigo: MODULOS.LIBRO_DIARIO,
    nombre: 'Libro diario',
    descripcion: 'Asientos del mes',
    route: '/contabilidad/diario',
    icono: 'menu_book',
    orden: 2,
    grupo: 'g_contabilidad',
    ambito: N,
    opciones: [VER],
  },
  {
    codigo: MODULOS.LIBRO_MAYOR,
    nombre: 'Libro mayor',
    descripcion: 'Movimientos por cuenta y por producto',
    route: '/contabilidad/mayor',
    icono: 'book',
    orden: 3,
    grupo: 'g_contabilidad',
    ambito: N,
    opciones: [VER],
  },
  {
    codigo: MODULOS.CUADRE,
    nombre: 'Cuadre contable',
    descripcion: 'Control de cuadre entre auxiliares y cuentas',
    route: '/contabilidad/cuadre',
    icono: 'balance',
    orden: 4,
    grupo: 'g_contabilidad',
    ambito: N,
    opciones: [VER],
  },
  {
    codigo: MODULOS.CIERRE_MENSUAL,
    nombre: 'Cierre mensual',
    descripcion: 'Cierre y reapertura de meses',
    route: '/cierre',
    icono: 'event_available',
    orden: 60,
    grupo: null,
    ambito: N,
    opciones: [VER, CERRAR, REABRIR],
  },
  {
    codigo: MODULOS.ESTADO_RESULTADOS,
    nombre: 'Estado de resultados',
    descripcion: 'Resultado del mes por producto y línea',
    route: '/analisis/estado-resultados',
    icono: 'query_stats',
    orden: 1,
    grupo: 'g_analisis',
    ambito: N,
    opciones: [VER, VER_COSTOS],
  },
  {
    codigo: MODULOS.RANKING,
    nombre: 'Ranking',
    descripcion: 'Productos y líneas que más ganan y pierden',
    route: '/analisis/ranking',
    icono: 'leaderboard',
    orden: 2,
    grupo: 'g_analisis',
    ambito: N,
    opciones: [VER, VER_COSTOS],
  },
  {
    codigo: MODULOS.DASHBOARD,
    nombre: 'Dashboard',
    descripcion: 'Evolución mensual de ventas y utilidad',
    route: '/dashboard',
    icono: 'dashboard',
    orden: 3,
    grupo: 'g_analisis',
    ambito: N,
    opciones: [VER, VER_COSTOS],
  },
  {
    codigo: MODULOS.NEGOCIO,
    nombre: 'Datos del negocio',
    descripcion: 'Régimen tributario y criterio de prorrateo',
    route: '/configuracion/negocio',
    icono: 'store',
    orden: 1,
    grupo: 'g_configuracion',
    ambito: N,
    opciones: [VER, EDITAR],
  },
  {
    codigo: MODULOS.CATEGORIAS_GASTO,
    nombre: 'Categorías de gasto',
    descripcion: 'Categorías de gasto indirecto',
    route: '/configuracion/categorias-gasto',
    icono: 'sell',
    orden: 2,
    grupo: 'g_configuracion',
    ambito: N,
    opciones: [VER, CREAR, EDITAR, ELIMINAR],
  },
  {
    codigo: MODULOS.USUARIOS,
    nombre: 'Usuarios',
    descripcion: 'Empleados del negocio',
    route: '/seguridad/usuarios',
    icono: 'group',
    orden: 1,
    grupo: 'g_seguridad',
    ambito: N,
    opciones: [VER, CREAR, EDITAR, ELIMINAR],
  },
  {
    codigo: MODULOS.ROLES,
    nombre: 'Roles y permisos',
    descripcion: 'Roles del negocio y su matriz de permisos',
    route: '/seguridad/roles',
    icono: 'admin_panel_settings',
    orden: 2,
    grupo: 'g_seguridad',
    ambito: N,
    opciones: [VER, CREAR, EDITAR, ELIMINAR],
  },
  {
    codigo: MODULOS.BITACORA,
    nombre: 'Bitácora',
    descripcion: 'Acciones sensibles del negocio',
    route: '/seguridad/bitacora',
    icono: 'history',
    orden: 3,
    grupo: 'g_seguridad',
    ambito: N,
    opciones: [VER],
  },
  {
    codigo: MODULOS.NEGOCIOS,
    nombre: 'Negocios',
    descripcion: 'Negocios registrados en la plataforma',
    route: '/plataforma/negocios',
    icono: 'storefront',
    orden: 1,
    grupo: 'g_plataforma',
    ambito: P,
    opciones: [VER, EDITAR],
  },
  {
    codigo: MODULOS.BITACORA_PLATAFORMA,
    nombre: 'Bitácora de plataforma',
    descripcion: 'Eventos de seguridad de la plataforma',
    route: '/plataforma/bitacora',
    icono: 'history',
    orden: 2,
    grupo: 'g_plataforma',
    ambito: P,
    opciones: [VER],
  },
];

/** Roles fijos (decisión 44). */
export const ROL_DUENO = 'Dueño';
export const ROL_EMPLEADO = 'Empleado';
export const ROL_PLATAFORMA = 'Administrador de plataforma';

/** Mínimo del rol Empleado de un negocio nuevo (spec §2). */
export const PERMISOS_EMPLEADO: readonly {
  modulo: CodigoModulo;
  opciones: readonly CodigoOpcion[];
}[] = [
  { modulo: MODULOS.POS, opciones: [VER, CREAR] },
  { modulo: MODULOS.VENTAS, opciones: [VER, CREAR] },
  { modulo: MODULOS.PRODUCTOS, opciones: [VER] },
  { modulo: MODULOS.LINEAS, opciones: [VER] },
  { modulo: MODULOS.INVENTARIO, opciones: [VER] },
];
