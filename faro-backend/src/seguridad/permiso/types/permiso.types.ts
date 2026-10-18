import { Ambito } from '../constants/catalogo';

/** Un permiso activo, como lo recibe el frontend (`architecture.md` §11). */
export interface PermisoActivo {
  modulo: string;
  opcion: string;
}

/** Nodo del menú: un grupo (con `hijos`, sin `route`) o un módulo hoja. */
export interface ItemMenu {
  codigo: string;
  nombre: string;
  route: string | null;
  icono: string;
  hijos?: ItemMenu[];
}

export interface OpcionMatriz {
  codigo: string;
  nombre: string;
  activo: boolean;
}

/** Una fila de la matriz de permisos de un rol: módulo con sus opciones válidas. */
export interface ModuloMatriz {
  codigo: string;
  nombre: string;
  /** Nombre del grupo del menú, o `null` si el módulo es de nivel superior. */
  grupo: string | null;
  opciones: OpcionMatriz[];
}

/** Un par válido módulo × opción del catálogo, con sus ids. */
export interface ParCatalogo {
  idModuloSistema: number;
  idOpcionModuloSistema: number;
  modulo: string;
  opcion: string;
  ambito: Ambito;
}
