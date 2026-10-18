import { DataSource } from 'typeorm';
import { Persona } from '@seguridad/entities/persona.entity';
import { Usuario } from '@seguridad/entities/usuario.entity';
import { errorDeClave, hashearClave } from '@seguridad/utils/clave';

export interface DatosAdminPlataforma {
  usuario: string;
  clave: string;
  nombre: string;
  /**
   * `true` en producción: la clave queda en texto plano en el `.env` del
   * servidor, así que no debe seguir siendo la definitiva (OWASP ASVS V2.3.1).
   */
  debeCambiarClave: boolean;
}

export type ResultadoSeedAdmin = 'creado' | 'existente';

/**
 * Crea al administrador de plataforma (persona y usuario sin negocio). Es
 * **idempotente**: si ya hay un usuario activo con ese login (sin distinguir
 * mayúsculas) no hace nada y **no pisa su clave**. Corre fuera de una petición,
 * sin contexto, así que `AuditoriaSubscriber` respeta el `idNegocio` nulo.
 */
export async function sembrarAdminPlataforma(
  dataSource: DataSource,
  datos: DatosAdminPlataforma,
): Promise<ResultadoSeedAdmin> {
  const usuario = datos.usuario.trim();
  const nombre = datos.nombre.trim();
  if (usuario === '') throw new Error('ADMIN_USUARIO no puede estar vacío.');
  if (nombre === '') throw new Error('ADMIN_NOMBRE no puede estar vacío.');
  const errorClave = errorDeClave(datos.clave);
  if (errorClave) throw new Error(`ADMIN_CLAVE inválida: ${errorClave}`);

  return dataSource.transaction(async (manager) => {
    const existente = await manager
      .createQueryBuilder(Usuario, 'u')
      .where('lower(u.usuario) = lower(:usuario)', { usuario })
      .andWhere('u.idEstado = 1')
      .getCount();
    if (existente > 0) return 'existente';

    const persona = await manager.save(
      manager.create(Persona, {
        idNegocio: null,
        tipo: 'NATURAL',
        nombre,
        paterno: null,
        materno: null,
        tipoDocumento: null,
        documento: null,
        correo: null,
        telefono: null,
      }),
    );
    await manager.save(
      manager.create(Usuario, {
        idNegocio: null,
        usuario,
        clave: await hashearClave(datos.clave),
        idPersona: persona.idPersona,
        debeCambiarClave: datos.debeCambiarClave,
      }),
    );
    return 'creado';
  });
}
