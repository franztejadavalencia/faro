/** Lo que tienen en común `QueryRunner` (migraciones) y `EntityManager`. */
export interface EjecutorSql {
  query(sql: string, parametros?: unknown[]): Promise<unknown>;
}

/**
 * Para la migración que agrega un módulo (o una opción de uno existente) al
 * catálogo: concede **todas** las opciones del módulo a los roles fijos de su
 * ámbito (el Dueño de cada negocio, o el rol de plataforma), que no se editan
 * a mano (decisión 44). Idempotente; reactiva un permiso inactivo. Un módulo
 * nuevo sin esta llamada deja al Dueño sin acceso: lo detecta el e2e «todo rol
 * fijo tiene todos los pares de su ámbito» (decisión 99).
 *
 * Devuelve cuántos permisos quedaron concedidos.
 */
export async function otorgarARolesFijos(
  ejecutor: EjecutorSql,
  codigoModulo: string,
): Promise<number> {
  const modulo = (await ejecutor.query(
    `SELECT 1 FROM modulo_sistema WHERE codigo = $1 AND tipo_modulo = 'MENU'`,
    [codigoModulo],
  )) as unknown[];
  if (modulo.length === 0) {
    throw new Error(
      `otorgarARolesFijos: no existe el módulo «${codigoModulo}».`,
    );
  }
  const concedidos = (await ejecutor.query(
    `INSERT INTO permiso_rol_usuario (id_rol_usuario, id_modulo_sistema, id_opcion_modulo_sistema, activo)
     SELECT r.id_rol_usuario, mo.id_modulo_sistema, mo.id_opcion_modulo_sistema, true
     FROM rol_usuario r
     JOIN modulo_sistema m ON m.codigo = $1
       AND m.ambito = CASE WHEN r.id_negocio IS NULL THEN 'PLATAFORMA' ELSE 'NEGOCIO' END
     JOIN modulo_opcion_sistema mo ON mo.id_modulo_sistema = m.id_modulo_sistema
     WHERE r.es_fijo = true AND r.id_estado = 1
     ON CONFLICT (id_rol_usuario, id_modulo_sistema, id_opcion_modulo_sistema)
       DO UPDATE SET activo = true
     RETURNING 1`,
    [codigoModulo],
  )) as unknown[];
  return concedidos.length;
}
