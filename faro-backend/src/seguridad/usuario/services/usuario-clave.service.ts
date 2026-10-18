import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EVENTOS_BITACORA } from '../../constants/eventos-bitacora';
import { Usuario } from '../../entities/usuario.entity';
import { BitacoraService } from '../../services/bitacora.service';
import { errorDeClave, hashearClave } from '../../utils/clave';
import { ActorGestion } from '../types/actor-gestion';

/**
 * Restablecer la clave de otro usuario y desbloquearlo. Son las **operaciones**
 * que usa el dueño sobre sus empleados (B7) y que D14 reusará desde plataforma
 * sobre el dueño: no buscan al usuario ni aplican la jerarquía de roles (eso es
 * del llamador, que sabe de qué negocio es), reciben el `actor` y lo dejan en
 * la bitácora.
 *
 * Escriben con un `UPDATE` explícito y `usuario_modificacion` del actor (regla
 * 2): atómico y sin depender del negocio del contexto.
 */
@Injectable()
export class UsuarioClaveService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    private readonly bitacora: BitacoraService,
  ) {}

  /**
   * Clave temporal nueva: `debe_cambiar_clave = true`, `version_sesion + 1` (las
   * sesiones abiertas del usuario mueren, decisión 87) y contador y bloqueo en 0.
   * No devuelve ni registra la clave.
   */
  async restablecer(
    objetivo: Pick<Usuario, 'idUsuario'>,
    claveTemporal: string,
    actor: ActorGestion,
  ): Promise<void> {
    const error = errorDeClave(claveTemporal);
    if (error) throw new BadRequestException(error);

    await this.usuarios
      .createQueryBuilder()
      .update(Usuario)
      .set({
        clave: await hashearClave(claveTemporal),
        debeCambiarClave: true,
        versionSesion: () => 'version_sesion + 1',
        intentosFallidos: 0,
        bloqueadoHasta: null,
        usuarioModificacion: actor.idUsuario,
      })
      .where('id_usuario = :id', { id: objetivo.idUsuario })
      .execute();
    await this.bitacora.registrar(EVENTOS_BITACORA.CLAVE_RESTABLECIDA, {
      idUsuarioObjetivo: objetivo.idUsuario,
      actor: actor.tipo,
    });
  }

  /**
   * Quita el bloqueo temporal antes de tiempo. No sube `version_sesion`
   * (decisión 87): el bloqueo frena el próximo login, no corta sesiones.
   */
  async desbloquear(
    objetivo: Pick<Usuario, 'idUsuario'>,
    actor: ActorGestion,
  ): Promise<void> {
    await this.usuarios
      .createQueryBuilder()
      .update(Usuario)
      .set({
        intentosFallidos: 0,
        bloqueadoHasta: null,
        usuarioModificacion: actor.idUsuario,
      })
      .where('id_usuario = :id', { id: objetivo.idUsuario })
      .execute();
    await this.bitacora.registrar(EVENTOS_BITACORA.USUARIO_DESBLOQUEADO, {
      idUsuarioObjetivo: objetivo.idUsuario,
      actor: actor.tipo,
    });
  }
}
