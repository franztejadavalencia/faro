/**
 * Quién restablece una clave, desbloquea o actúa sobre otro usuario: el dueño de
 * un negocio sobre sus empleados (B7) o, desde D14, la plataforma sobre el dueño.
 * La bitácora lo registra en `detalle.actor`.
 */
export interface ActorGestion {
  tipo: 'NEGOCIO' | 'PLATAFORMA';
  idUsuario: number;
}

/** El actor de una ruta de negocio, con el rol vigente que lee el guard JWT. */
export interface ActorNegocio extends ActorGestion {
  tipo: 'NEGOCIO';
  idRolUsuario: number;
}
