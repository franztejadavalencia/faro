import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EVENTOS_BITACORA,
  EventoBitacora,
} from '../../constants/eventos-bitacora';
import { Usuario } from '../../entities/usuario.entity';
import { ActorAcceso, BitacoraService } from '../../services/bitacora.service';
import {
  MAX_INTENTOS_FALLIDOS,
  MINUTOS_BLOQUEO,
} from '../constants/auth.constants';

/**
 * Contador de fallos y bloqueo temporal (decisión 53), compartido por el login,
 * el cambio de clave y la 2FA: fallos de clave y de código suman juntos.
 */
@Injectable()
export class IntentosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    private readonly bitacora: BitacoraService,
  ) {}

  /**
   * Suma un fallo en **un solo** `UPDATE` (peticiones en paralelo no leen un
   * contador viejo). Al llegar a `MAX_INTENTOS_FALLIDOS` pone `bloqueado_hasta`
   * con la hora de la base (dato de seguridad, hora real) y vuelve el contador a
   * 0. Una cuenta ya bloqueada no suma. Un QueryBuilder no pasa por
   * `AuditoriaSubscriber`: no hay actor autenticado y el hecho queda en la
   * bitácora.
   */
  async sumarFallo(
    actor: ActorAcceso,
    evento: EventoBitacora,
    detalle: Record<string, unknown>,
  ): Promise<void> {
    const llega = 'intentos_fallidos + 1 >= :maximo';
    const resultado = await this.usuarios
      .createQueryBuilder()
      .update(Usuario)
      .set({
        intentosFallidos: () =>
          `CASE WHEN ${llega} THEN 0 ELSE intentos_fallidos + 1 END`,
        bloqueadoHasta: () =>
          `CASE WHEN ${llega} THEN now() + make_interval(mins => :minutos) ELSE NULL END`,
      })
      .where('id_usuario = :id', { id: actor.idUsuario })
      .andWhere('(bloqueado_hasta IS NULL OR bloqueado_hasta <= now())')
      .setParameters({
        maximo: MAX_INTENTOS_FALLIDOS,
        minutos: MINUTOS_BLOQUEO,
      })
      // Texto y no arreglo: con arreglo TypeORM espera nombres de propiedad.
      .returning('intentos_fallidos')
      .execute();
    const filas = resultado.raw as { intentos_fallidos: number }[];
    const intentos = filas[0]?.intentos_fallidos;

    await this.bitacora.registrarAcceso(evento, actor, {
      ...detalle,
      ...(intentos === undefined ? {} : { intentos }),
    });
    if (intentos === 0) {
      await this.bitacora.registrarAcceso(
        EVENTOS_BITACORA.BLOQUEO_CUENTA,
        actor,
        { minutos: MINUTOS_BLOQUEO },
      );
    }
  }

  /** Tras entrar del todo (clave y, si corresponde, 2FA): contador a 0. */
  async reiniciar(usuario: Usuario): Promise<void> {
    if (usuario.intentosFallidos === 0 && usuario.bloqueadoHasta === null) {
      return;
    }
    await this.usuarios
      .createQueryBuilder()
      .update(Usuario)
      .set({ intentosFallidos: 0, bloqueadoHasta: null })
      .where('id_usuario = :id', { id: usuario.idUsuario })
      .execute();
  }
}

/** Bloqueo vigente según la hora real (decisión 61: dato de seguridad). */
export function estaBloqueado(usuario: Usuario): boolean {
  return (
    usuario.bloqueadoHasta !== null &&
    usuario.bloqueadoHasta.getTime() > Date.now()
  );
}
