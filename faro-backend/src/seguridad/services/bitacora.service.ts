import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContextService } from '@common/services/request-context.service';
import { EventoBitacora } from '../constants/eventos-bitacora';
import { Bitacora } from '../entities/bitacora.entity';

/** Quién actúa en un evento de acceso, leído de la fila de `usuario`. */
export interface ActorAcceso {
  idUsuario: number;
  idNegocio: number | null;
}

/** `ip` es `varchar(64)`; un valor más largo no debe tumbar el registro. */
const MAX_IP = 64;

/**
 * Único punto de acceso a `bitacora` (decisión 84). `ip`, `user_agent`, `url` y
 * `metodo` salen siempre del contexto del request; nunca la cabecera
 * `Authorization` ni el token. `consultar` llega en B7.
 */
@Injectable()
export class BitacoraService {
  constructor(
    @InjectRepository(Bitacora)
    private readonly bitacoras: Repository<Bitacora>,
    private readonly contexto: RequestContextService,
  ) {}

  /** Evento de un usuario con sesión: usuario y negocio salen del contexto. */
  async registrar(
    evento: EventoBitacora,
    detalle: Record<string, unknown> | null = null,
  ): Promise<void> {
    const contexto = this.contexto.obtenerContexto();
    await this.insertar(evento, detalle, {
      idUsuario: contexto?.idUsuario ?? null,
      idNegocio: contexto?.idNegocio ?? null,
    });
  }

  /**
   * Evento **antes** de que haya sesión (login; en B5, la verificación 2FA), cuando
   * el contexto todavía no tiene usuario. Solo lo llaman `AuthService` y la 2FA.
   * `actor` sale **siempre** de la fila de `usuario` leída en el servidor, nunca
   * del body ni de la ruta; es `null` si el usuario no existe.
   */
  async registrarAcceso(
    evento: EventoBitacora,
    actor: ActorAcceso | null,
    detalle: Record<string, unknown> | null = null,
  ): Promise<void> {
    await this.insertar(evento, detalle, {
      idUsuario: actor?.idUsuario ?? null,
      idNegocio: actor?.idNegocio ?? null,
    });
  }

  private async insertar(
    evento: EventoBitacora,
    detalle: Record<string, unknown> | null,
    actor: { idUsuario: number | null; idNegocio: number | null },
  ): Promise<void> {
    const contexto = this.contexto.obtenerContexto();
    // `save` y no `insert`: el tipo de `insert` no admite la columna `jsonb`.
    await this.bitacoras.save(
      this.bitacoras.create({
        evento,
        detalle,
        idUsuario: actor.idUsuario,
        idNegocio: actor.idNegocio,
        ip: contexto?.ip?.slice(0, MAX_IP) ?? null,
        userAgent: contexto?.userAgent ?? null,
        url: contexto?.url ?? null,
        metodo: contexto?.metodo ?? null,
      }),
    );
  }
}
