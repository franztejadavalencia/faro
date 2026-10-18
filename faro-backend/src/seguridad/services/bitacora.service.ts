import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TAMANO_PAGINA_POR_DEFECTO,
  TAMANO_PAGINA_MAXIMO,
} from '@common/dto/paginacion.dto';
import { RequestContextService } from '@common/services/request-context.service';
import { validateDateRange, ZONA_HORARIA } from '@common/utils/date.utils';
import {
  EVENTOS_BITACORA,
  EventoBitacora,
} from '../constants/eventos-bitacora';
import {
  FiltroBitacoraDto,
  PaginaBitacoraDto,
} from '../dto/filtro-bitacora.dto';
import { nombreCompleto } from '../utils/nombre-completo';
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
 * `Authorization` ni el token. `consultar` (B7) lee solo la bitácora del negocio
 * del contexto.
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

  /** Los eventos que existen, para el filtro del dueño. */
  eventos(): string[] {
    return Object.values(EVENTOS_BITACORA).sort();
  }

  /**
   * Bitácora **del negocio de la sesión** (decisión 84). Falla cerrado: el
   * `idNegocio` sale del contexto, nunca del filtro, y sin él responde 403.
   * Solo filas con ese `id_negocio`: los eventos de plataforma y los de un
   * usuario inexistente (`id_negocio` nulo) no se ven. `desde` y `hasta` son
   * días inclusivos en `ZONA_HORARIA` (fechas técnicas: hora real, no el
   * `Reloj` de negocio, decisión 61). No devuelve `user_agent`.
   */
  async consultar(filtro: FiltroBitacoraDto): Promise<PaginaBitacoraDto> {
    const idNegocio = this.contexto.obtenerIdNegocio();
    if (idNegocio === undefined) {
      throw new ForbiddenException('Esta operación requiere un negocio.');
    }
    if (filtro.desde && filtro.hasta) {
      validateDateRange(filtro.desde, filtro.hasta, 'desde', 'hasta');
    }
    const pagina = filtro.pagina ?? 1;
    const tamano = Math.min(
      filtro.tamano ?? TAMANO_PAGINA_POR_DEFECTO,
      TAMANO_PAGINA_MAXIMO,
    );

    const consulta = this.bitacoras
      .createQueryBuilder('b')
      .leftJoin('b.usuario', 'u')
      .leftJoin('u.persona', 'p')
      .select([
        'b.idBitacora',
        'b.fecha',
        'b.evento',
        'b.detalle',
        'b.ip',
        'b.url',
        'b.metodo',
        'u.idUsuario',
        'p.nombre',
        'p.paterno',
        'p.materno',
      ])
      .where('b.idNegocio = :idNegocio', { idNegocio });
    if (filtro.idUsuario !== undefined) {
      consulta.andWhere('b.idUsuario = :idUsuario', {
        idUsuario: filtro.idUsuario,
      });
    }
    if (filtro.evento) {
      consulta.andWhere('b.evento = :evento', { evento: filtro.evento });
    }
    if (filtro.desde) {
      consulta.andWhere(
        'b.fecha >= (CAST(:desde AS date)::timestamp AT TIME ZONE :zona)',
        { desde: filtro.desde, zona: ZONA_HORARIA },
      );
    }
    if (filtro.hasta) {
      consulta.andWhere(
        'b.fecha < ((CAST(:hasta AS date) + 1)::timestamp AT TIME ZONE :zona)',
        { hasta: filtro.hasta, zona: ZONA_HORARIA },
      );
    }

    const [filas, total] = await consulta
      .orderBy('b.fecha', 'DESC')
      .addOrderBy('b.idBitacora', 'DESC')
      .skip((pagina - 1) * tamano)
      .take(tamano)
      .getManyAndCount();
    return {
      items: filas.map((f) => ({
        id: f.idBitacora,
        fecha: f.fecha,
        evento: f.evento,
        usuario: f.usuario
          ? {
              id: f.usuario.idUsuario,
              nombre: f.usuario.persona
                ? nombreCompleto(f.usuario.persona)
                : '',
            }
          : null,
        ip: f.ip,
        detalle: f.detalle,
        url: f.url,
        metodo: f.metodo,
      })),
      total,
      pagina,
      tamano,
    };
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
