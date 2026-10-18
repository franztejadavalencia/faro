import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Ambito } from '../constants/catalogo';
import { CodigoModulo } from '../constants/modulos';
import { CodigoOpcion, OPCIONES } from '../constants/opciones';
import {
  ItemMenu,
  ModuloMatriz,
  ParCatalogo,
  PermisoActivo,
} from '../types/permiso.types';

interface FilaMenu {
  codigo: string;
  nombre: string;
  route: string | null;
  icono: string;
  orden: number;
  grupo: string | null;
}

interface FilaMatriz {
  modulo: string;
  modulo_nombre: string;
  grupo: string | null;
  opcion: string;
  opcion_nombre: string;
  activo: boolean;
}

/**
 * Lectura de permisos, menú y matriz de un rol. Sin `id_negocio`: quien llama
 * ya comprobó que el rol es de la sesión (el guard lo lee de la fila del
 * usuario) o del negocio (`RolUsuarioService`, con `NegocioRepository`).
 */
@Injectable()
export class PermisoService {
  constructor(private readonly dataSource: DataSource) {}

  /** Una consulta puntual: la usa el guard en cada ruta con `@RequierePermiso`. */
  async tiene(
    idRol: number,
    modulo: CodigoModulo,
    opcion: CodigoOpcion,
  ): Promise<boolean> {
    const filas = await this.dataSource.query<unknown[]>(
      `SELECT 1
       FROM permiso_rol_usuario p
       JOIN rol_usuario r ON r.id_rol_usuario = p.id_rol_usuario AND r.id_estado = 1
       JOIN modulo_sistema m ON m.id_modulo_sistema = p.id_modulo_sistema AND m.id_estado = 1
       JOIN opcion_modulo_sistema o ON o.id_opcion_modulo_sistema = p.id_opcion_modulo_sistema AND o.id_estado = 1
       WHERE p.id_rol_usuario = $1 AND m.codigo = $2 AND o.codigo = $3
         AND p.activo = true AND p.id_estado = 1
       LIMIT 1`,
      [idRol, modulo, opcion],
    );
    return filas.length > 0;
  }

  async permisosDelRol(idRol: number): Promise<PermisoActivo[]> {
    return this.dataSource.query<PermisoActivo[]>(
      `SELECT m.codigo AS modulo, o.codigo AS opcion
       FROM permiso_rol_usuario p
       JOIN rol_usuario r ON r.id_rol_usuario = p.id_rol_usuario AND r.id_estado = 1
       JOIN modulo_sistema m ON m.id_modulo_sistema = p.id_modulo_sistema AND m.id_estado = 1
       JOIN opcion_modulo_sistema o ON o.id_opcion_modulo_sistema = p.id_opcion_modulo_sistema AND o.id_estado = 1
       WHERE p.id_rol_usuario = $1 AND p.activo = true AND p.id_estado = 1
       ORDER BY m.codigo, o.orden`,
      [idRol],
    );
  }

  /**
   * Menú del rol: los módulos hoja donde tiene `ver` y, sobre ellos, sus grupos
   * (un grupo sin ningún módulo visible no aparece). Como el `findMenu` de SIAP,
   * pero exigiendo `ver` y no «cualquier opción».
   */
  async menuDelRol(idRol: number): Promise<ItemMenu[]> {
    const hojas = await this.dataSource.query<FilaMenu[]>(
      `SELECT m.codigo, m.nombre, m.route, m.icono, m.orden, g.codigo AS grupo
       FROM modulo_sistema m
       LEFT JOIN modulo_sistema g ON g.id_modulo_sistema = m.id_grupo_modulo_sistema
       JOIN permiso_rol_usuario p ON p.id_modulo_sistema = m.id_modulo_sistema
         AND p.id_rol_usuario = $1 AND p.activo = true AND p.id_estado = 1
       JOIN opcion_modulo_sistema o ON o.id_opcion_modulo_sistema = p.id_opcion_modulo_sistema
         AND o.codigo = $2
       JOIN rol_usuario r ON r.id_rol_usuario = p.id_rol_usuario AND r.id_estado = 1
       WHERE m.tipo_modulo = 'MENU' AND m.id_estado = 1
       ORDER BY m.orden`,
      [idRol, OPCIONES.VER],
    );
    if (hojas.length === 0) return [];

    const grupos = await this.dataSource.query<FilaMenu[]>(
      `SELECT codigo, nombre, route, icono, orden, NULL AS grupo
       FROM modulo_sistema
       WHERE tipo_modulo = 'GRUPO' AND id_estado = 1`,
    );
    const hijosDe = new Map<string, ItemMenu[]>();
    const nivelSuperior: { orden: number; item: ItemMenu }[] = [];
    for (const hoja of hojas) {
      const item = this.aItem(hoja);
      if (hoja.grupo === null) {
        nivelSuperior.push({ orden: hoja.orden, item });
      } else {
        hijosDe.set(hoja.grupo, [...(hijosDe.get(hoja.grupo) ?? []), item]);
      }
    }
    for (const grupo of grupos) {
      const hijos = hijosDe.get(grupo.codigo);
      if (hijos) {
        nivelSuperior.push({
          orden: grupo.orden,
          item: { ...this.aItem(grupo), hijos },
        });
      }
    }
    return nivelSuperior.sort((a, b) => a.orden - b.orden).map((n) => n.item);
  }

  /** Módulos del ámbito con sus opciones válidas y si el rol las tiene activas. */
  async matrizDelRol(
    idRol: number,
    ambito: Ambito,
    manager?: EntityManager,
  ): Promise<ModuloMatriz[]> {
    const filas = await (manager ?? this.dataSource.manager).query<
      FilaMatriz[]
    >(
      `SELECT m.codigo AS modulo, m.nombre AS modulo_nombre, g.nombre AS grupo,
              o.codigo AS opcion, o.nombre AS opcion_nombre,
              COALESCE(p.activo, false) AS activo
       FROM modulo_opcion_sistema mo
       JOIN modulo_sistema m ON m.id_modulo_sistema = mo.id_modulo_sistema
         AND m.ambito = $2 AND m.id_estado = 1
       LEFT JOIN modulo_sistema g ON g.id_modulo_sistema = m.id_grupo_modulo_sistema
       JOIN opcion_modulo_sistema o ON o.id_opcion_modulo_sistema = mo.id_opcion_modulo_sistema
         AND o.id_estado = 1
       LEFT JOIN permiso_rol_usuario p ON p.id_rol_usuario = $1
         AND p.id_modulo_sistema = mo.id_modulo_sistema
         AND p.id_opcion_modulo_sistema = mo.id_opcion_modulo_sistema
         AND p.id_estado = 1
       ORDER BY COALESCE(g.orden, m.orden), m.orden, o.orden`,
      [idRol, ambito],
    );
    const modulos = new Map<string, ModuloMatriz>();
    for (const f of filas) {
      const modulo = modulos.get(f.modulo) ?? {
        codigo: f.modulo,
        nombre: f.modulo_nombre,
        grupo: f.grupo,
        opciones: [],
      };
      modulo.opciones.push({
        codigo: f.opcion,
        nombre: f.opcion_nombre,
        activo: f.activo,
      });
      modulos.set(f.modulo, modulo);
    }
    return [...modulos.values()];
  }

  /** Todos los pares válidos de un ámbito (para validar un `PUT` y sembrar roles). */
  async paresDeAmbito(
    ambito: Ambito,
    manager?: EntityManager,
  ): Promise<ParCatalogo[]> {
    const filas = await (manager ?? this.dataSource.manager).query<
      {
        id_modulo: number;
        id_opcion: number;
        modulo: string;
        opcion: string;
      }[]
    >(
      `SELECT m.id_modulo_sistema AS id_modulo, o.id_opcion_modulo_sistema AS id_opcion,
              m.codigo AS modulo, o.codigo AS opcion
       FROM modulo_opcion_sistema mo
       JOIN modulo_sistema m ON m.id_modulo_sistema = mo.id_modulo_sistema
         AND m.ambito = $1 AND m.id_estado = 1
       JOIN opcion_modulo_sistema o ON o.id_opcion_modulo_sistema = mo.id_opcion_modulo_sistema
         AND o.id_estado = 1`,
      [ambito],
    );
    return filas.map((f) => ({
      idModuloSistema: f.id_modulo,
      idOpcionModuloSistema: f.id_opcion,
      modulo: f.modulo,
      opcion: f.opcion,
      ambito,
    }));
  }

  private aItem(fila: FilaMenu): ItemMenu {
    return {
      codigo: fila.codigo,
      nombre: fila.nombre,
      route: fila.route,
      icono: fila.icono,
    };
  }
}
