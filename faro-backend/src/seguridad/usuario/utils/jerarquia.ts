import { PermisoActivo } from '../../permiso/types/permiso.types';

const clave = (p: PermisoActivo): string => `${p.modulo}.${p.opcion}`;

/**
 * Los pares (`modulo.opcion`) de `requeridos` que `delEditor` no tiene: lista
 * vacía = el editor **cubre** ese rol (decisión 99). Es la regla de B6 llevada a
 * los usuarios: no se actúa sobre un usuario, ni se le da un rol, con más
 * permisos de los que uno mismo tiene (AWS IAM, *permissions boundary*; Odoo).
 * Cubrir es «tener todos», no «tener más»: dos usuarios del mismo rol se cubren
 * entre sí (decisión 102).
 */
export function paresFaltantes(
  delEditor: readonly PermisoActivo[],
  requeridos: readonly PermisoActivo[],
): string[] {
  const tiene = new Set(delEditor.map(clave));
  return requeridos
    .map(clave)
    .filter((par) => !tiene.has(par))
    .sort();
}
