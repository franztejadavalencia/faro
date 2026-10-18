import { DataSource } from 'typeorm';
import { Negocio } from '../../src/plataforma/entities/negocio.entity';
import { RolUsuario } from '../../src/seguridad/permiso/entities/rol-usuario.entity';
import { crearUsuarioDePrueba, UsuarioDePrueba } from './usuarios-de-prueba';

let secuencia = 0;

/**
 * Rol propio del negocio con exactamente estos permisos (`modulo.opcion`),
 * fuera de la API: para armar el escenario de una prueba.
 */
export async function crearRolConPermisos(
  dataSource: DataSource,
  negocio: Negocio,
  permisos: string[],
  nombre?: string,
): Promise<number> {
  secuencia += 1;
  const roles = dataSource.getRepository(RolUsuario);
  const rol = await roles.save(
    roles.create({
      idNegocio: negocio.idNegocio,
      nombre: nombre ?? `Rol de prueba ${secuencia}`,
      descripcion: null,
      esFijo: false,
    }),
  );
  for (const permiso of permisos) {
    const [modulo, opcion] = permiso.split('.');
    const concedidos = await dataSource.query<unknown[]>(
      `INSERT INTO permiso_rol_usuario (id_rol_usuario, id_modulo_sistema, id_opcion_modulo_sistema, activo)
       SELECT $1, mo.id_modulo_sistema, mo.id_opcion_modulo_sistema, true
       FROM modulo_opcion_sistema mo
       JOIN modulo_sistema m ON m.id_modulo_sistema = mo.id_modulo_sistema
       JOIN opcion_modulo_sistema o ON o.id_opcion_modulo_sistema = mo.id_opcion_modulo_sistema
       WHERE m.codigo = $2 AND o.codigo = $3 RETURNING 1`,
      [rol.idRolUsuario, modulo, opcion],
    );
    if (concedidos.length !== 1) {
      throw new Error(`El permiso ${permiso} no existe en el catálogo.`);
    }
  }
  return rol.idRolUsuario;
}

/** Usuario del negocio cuyo rol propio tiene solo estos permisos. */
export async function crearUsuarioConPermisos(
  dataSource: DataSource,
  negocio: Negocio,
  permisos: string[],
  opciones: { idRolUsuario?: number; debeCambiarClave?: boolean } = {},
): Promise<UsuarioDePrueba> {
  const idRolUsuario =
    opciones.idRolUsuario ??
    (await crearRolConPermisos(dataSource, negocio, permisos));
  const u = await crearUsuarioDePrueba(dataSource, {
    negocio,
    rol: 'EMPLEADO',
    debeCambiarClave: opciones.debeCambiarClave,
  });
  await dataSource.query(
    'UPDATE usuario SET id_rol_usuario = $1 WHERE id_usuario = $2',
    [idRolUsuario, u.idUsuario],
  );
  return { ...u, idRolUsuario };
}
