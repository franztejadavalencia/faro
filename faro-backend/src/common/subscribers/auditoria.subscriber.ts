import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { BaseAnulableEntity } from '../entities/base-anulable.entity';
import { BaseEntity } from '../entities/base.entity';
import { BaseNegocioEntity } from '../entities/base-negocio.entity';
import { NegocioIncorrectoError } from '../errors/negocio-incorrecto.error';
import { RequestContextService } from '../services/request-context.service';

/**
 * Auditoría y aislamiento por negocio al guardar. Solo actúa con `save()`:
 * `update()`, `insert()` y los QueryBuilder no disparan el subscriber, y quien
 * los use sobre estas tablas setea `usuario_modificacion` a mano
 * (base-desde-siap.md, regla 2).
 */
@Injectable()
@EventSubscriber()
export class AuditoriaSubscriber implements EntitySubscriberInterface {
  constructor(
    dataSource: DataSource,
    private readonly requestContext: RequestContextService,
  ) {
    dataSource.subscribers.push(this);
  }

  beforeInsert(event: InsertEvent<unknown>): void {
    const entidad = event.entity;
    if (!(entidad instanceof BaseEntity)) return;

    const idUsuario = this.requestContext.obtenerIdUsuario();
    if (idUsuario) {
      entidad.usuarioRegistro = idUsuario;
    }

    if (entidad instanceof BaseNegocioEntity) {
      const idNegocio = this.requestContext.obtenerIdNegocio();
      // Sin negocio en el contexto (registro público, seed, plataforma) manda el
      // valor de la entidad; si falta, lo rechaza el NOT NULL.
      if (idNegocio === undefined) return;
      if (entidad.idNegocio == null) {
        entidad.idNegocio = idNegocio;
      } else if (entidad.idNegocio !== idNegocio) {
        throw new NegocioIncorrectoError(
          `Insert de ${event.metadata.name} con idNegocio ${entidad.idNegocio} ` +
            `en el contexto del negocio ${idNegocio}.`,
        );
      }
    }
  }

  beforeUpdate(event: UpdateEvent<unknown>): void {
    const entidad = event.entity;
    if (!entidad || !(entidad instanceof BaseEntity)) return;

    if (entidad instanceof BaseNegocioEntity) {
      this.verificarNegocioEnUpdate(
        entidad,
        event.databaseEntity as Partial<BaseNegocioEntity> | undefined,
        event.metadata.name,
      );
    }

    const idUsuario = this.requestContext.obtenerIdUsuario();
    if (idUsuario) {
      entidad.usuarioModificacion = idUsuario;
      // Quien anula queda como usuario de la anulación.
      if (
        entidad instanceof BaseAnulableEntity &&
        entidad.anulado &&
        entidad.usuarioAnulacion == null
      ) {
        entidad.usuarioAnulacion = idUsuario;
      }
    }
  }

  /**
   * Una fila existente no cambia de negocio (aunque no haya contexto) y, con
   * sesión de un negocio, solo se guarda una fila de ese negocio.
   */
  private verificarNegocioEnUpdate(
    entidad: BaseNegocioEntity,
    enBase: Partial<BaseNegocioEntity> | undefined,
    nombre: string,
  ): void {
    if (!enBase) return;
    const idEnBase = enBase.idNegocio;

    if (entidad.idNegocio !== undefined && entidad.idNegocio !== idEnBase) {
      throw new NegocioIncorrectoError(
        `Update de ${nombre}: no se puede cambiar idNegocio (${String(idEnBase)} → ${String(entidad.idNegocio)}).`,
      );
    }

    const idNegocio = this.requestContext.obtenerIdNegocio();
    if (idNegocio !== undefined && idEnBase !== idNegocio) {
      throw new NegocioIncorrectoError(
        `Update de ${nombre} del negocio ${String(idEnBase)} en el contexto del negocio ${idNegocio}.`,
      );
    }
  }
}
