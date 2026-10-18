import { EntityManager } from 'typeorm';
import {
  Ambito,
  PERMISOS_EMPLEADO,
  ROL_DUENO,
  ROL_EMPLEADO,
  ROL_PLATAFORMA,
} from '../constants/catalogo';
import { RolUsuario } from '../entities/rol-usuario.entity';

export interface RolesIniciales {
  idRolDueno: number;
  idRolEmpleado: number;
}

/** Concede todos los pares válidos de un ámbito a un rol (Dueño y plataforma). */
async function concederTodoElAmbito(
  manager: EntityManager,
  idRol: number,
  ambito: Ambito,
): Promise<void> {
  await manager.query(
    `INSERT INTO permiso_rol_usuario (id_rol_usuario, id_modulo_sistema, id_opcion_modulo_sistema, activo)
     SELECT $1, mo.id_modulo_sistema, mo.id_opcion_modulo_sistema, true
     FROM modulo_opcion_sistema mo
     JOIN modulo_sistema m ON m.id_modulo_sistema = mo.id_modulo_sistema
     WHERE m.ambito = $2 AND m.id_estado = 1`,
    [idRol, ambito],
  );
}

/**
 * Crea los roles de un negocio nuevo (decisión 44): **Dueño** (fijo, todos los
 * pares del ámbito NEGOCIO) y **Empleado** (el mínimo de spec §2, ver
 * `PERMISOS_EMPLEADO`). Lo llama `POST /api/registro` (D2) dentro de su
 * transacción; `manager` es el de esa transacción.
 */
export async function crearRolesIniciales(
  manager: EntityManager,
  idNegocio: number,
): Promise<RolesIniciales> {
  const roles = manager.getRepository(RolUsuario);
  const dueno = await roles.save(
    roles.create({
      idNegocio,
      nombre: ROL_DUENO,
      descripcion: 'Dueño del negocio: todos los permisos',
      esFijo: true,
    }),
  );
  await concederTodoElAmbito(manager, dueno.idRolUsuario, 'NEGOCIO');

  const empleado = await roles.save(
    roles.create({
      idNegocio,
      nombre: ROL_EMPLEADO,
      descripcion: 'Vende en el POS; el dueño ajusta sus permisos',
      esFijo: false,
    }),
  );
  for (const { modulo, opciones } of PERMISOS_EMPLEADO) {
    const concedidos = (await manager.query(
      `INSERT INTO permiso_rol_usuario (id_rol_usuario, id_modulo_sistema, id_opcion_modulo_sistema, activo)
       SELECT $1, mo.id_modulo_sistema, mo.id_opcion_modulo_sistema, true
       FROM modulo_opcion_sistema mo
       JOIN modulo_sistema m ON m.id_modulo_sistema = mo.id_modulo_sistema
       JOIN opcion_modulo_sistema o ON o.id_opcion_modulo_sistema = mo.id_opcion_modulo_sistema
       WHERE m.codigo = $2 AND o.codigo = ANY($3)
       RETURNING 1`,
      [empleado.idRolUsuario, modulo, opciones],
    )) as unknown[];
    if (concedidos.length !== opciones.length) {
      throw new Error(
        `PERMISOS_EMPLEADO: «${modulo}» no tiene todas las opciones ${opciones.join(', ')} en el catálogo.`,
      );
    }
  }
  return {
    idRolDueno: dueno.idRolUsuario,
    idRolEmpleado: empleado.idRolUsuario,
  };
}

/**
 * El rol de plataforma (`id_negocio` nulo, fijo), creado si falta, con todos los
 * pares del ámbito PLATAFORMA. La migración `Permisos` ya lo siembra; esta
 * función lo repone en una base vacía (`seed:admin`, `limpiarBase()` de los
 * e2e). Idempotente.
 */
export async function asegurarRolPlataforma(
  manager: EntityManager,
): Promise<number> {
  const roles = manager.getRepository(RolUsuario);
  const existente = await roles
    .createQueryBuilder('r')
    .where('r.idNegocio IS NULL')
    .andWhere('r.nombre = :nombre', { nombre: ROL_PLATAFORMA })
    .andWhere('r.idEstado = 1')
    .getOne();
  if (existente) return existente.idRolUsuario;

  const rol = await roles.save(
    roles.create({
      idNegocio: null,
      nombre: ROL_PLATAFORMA,
      descripcion: 'Administra la plataforma; no ve datos comerciales',
      esFijo: true,
    }),
  );
  await concederTodoElAmbito(manager, rol.idRolUsuario, 'PLATAFORMA');
  return rol.idRolUsuario;
}
