import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, EntityTarget } from 'typeorm';
import { BaseNegocioEntity } from '../entities/base-negocio.entity';
import { RequestContextService } from '../services/request-context.service';
import { NegocioRepository } from './negocio.repository';

/**
 * Crea `NegocioRepository` sobre la conexión o, dentro de una transacción
 * (decisión 31), sobre su `manager`:
 * `this.negocios.para(Producto, manager).findOneBy({ id })`.
 */
@Injectable()
export class NegocioRepositoryFactory {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly contexto: RequestContextService,
  ) {}

  para<T extends BaseNegocioEntity>(
    entidad: EntityTarget<T>,
    manager?: EntityManager,
  ): NegocioRepository<T> {
    const repositorio = (manager ?? this.dataSource.manager).getRepository(
      entidad,
    );
    return new NegocioRepository(repositorio, this.contexto);
  }
}
