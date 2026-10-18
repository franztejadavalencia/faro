import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  FindManyOptions,
  FindOneOptions,
  FindOptionsRelations,
  FindOptionsWhere,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { BaseNegocioEntity } from '../entities/base-negocio.entity';
import { RequestContextService } from '../services/request-context.service';

type Where<T> = FindOptionsWhere<T> | FindOptionsWhere<T>[];

/** Parámetro del filtro de negocio en los QueryBuilder. */
const PARAMETRO_NEGOCIO = 'idNegocioContexto';

/**
 * Acceso a los datos de **un** negocio (`architecture.md` §6, decisión 30).
 * Envuelve un `Repository` y agrega el `idNegocio` del contexto a toda lectura,
 * para que ningún servicio escriba ese filtro a mano:
 *
 * - El filtro **siempre gana**: pisa un `idNegocio` que traiga el `where`.
 * - **Falla cerrado**: sin `idNegocio` en el contexto (usuario de plataforma o
 *   ruta sin sesión) lanza 403 en lugar de consultar sin filtro.
 * - No expone `save`/`update`/`delete`/`query`: se guarda con el repositorio
 *   normal y `AuditoriaSubscriber` pone o verifica `idNegocio`.
 *
 * Se obtiene con `NegocioRepositoryFactory.para(Entidad, manager?)`. Los joins y
 * `relations` no se filtran aparte: entran por FK de la misma fila, y las
 * referencias que llegan en un DTO se validan con `requireActiveEntity`.
 */
export class NegocioRepository<T extends BaseNegocioEntity> {
  constructor(
    private readonly repositorio: Repository<T>,
    private readonly contexto: RequestContextService,
  ) {}

  find(opciones?: FindManyOptions<T>): Promise<T[]> {
    return this.repositorio.find({
      ...opciones,
      where: this.conNegocio(opciones?.where),
    });
  }

  findOne(opciones: FindOneOptions<T>): Promise<T | null> {
    return this.repositorio.findOne({
      ...opciones,
      where: this.conNegocio(opciones.where),
    });
  }

  findBy(where: Where<T>): Promise<T[]> {
    return this.repositorio.findBy(this.conNegocio(where));
  }

  findOneBy(where: Where<T>): Promise<T | null> {
    return this.repositorio.findOneBy(this.conNegocio(where));
  }

  findAndCount(opciones?: FindManyOptions<T>): Promise<[T[], number]> {
    return this.repositorio.findAndCount({
      ...opciones,
      where: this.conNegocio(opciones?.where),
    });
  }

  count(opciones?: FindManyOptions<T>): Promise<number> {
    return this.repositorio.count({
      ...opciones,
      where: this.conNegocio(opciones?.where),
    });
  }

  countBy(where: Where<T>): Promise<number> {
    return this.repositorio.countBy(this.conNegocio(where));
  }

  exists(opciones?: FindManyOptions<T>): Promise<boolean> {
    return this.repositorio.exists({
      ...opciones,
      where: this.conNegocio(opciones?.where),
    });
  }

  /**
   * La entidad activa (`id_estado = 1`) del negocio, o 404 como si no existiera
   * (también cuando existe en **otro** negocio).
   */
  async requireActiveEntity(
    where: FindOptionsWhere<T>,
    nombre: string,
    relations?: FindOptionsRelations<T>,
  ): Promise<T> {
    const entidad = await this.findOne({
      where: { ...where, idEstado: 1 } as FindOptionsWhere<T>,
      relations,
    });
    if (!entidad) {
      throw new NotFoundException(`No se encontró ${nombre} en estado activo`);
    }
    return entidad;
  }

  async requireActiveEntityIfPresent(
    id: number | null | undefined,
    campoId: Extract<keyof T, string>,
    nombre: string,
    relations?: FindOptionsRelations<T>,
  ): Promise<T | null> {
    if (id == null) return null;
    return this.requireActiveEntity(
      { [campoId]: id } as FindOptionsWhere<T>,
      nombre,
      relations,
    );
  }

  /**
   * Builder con `alias.idNegocio = :idNegocioContexto` ya puesto. Para que el
   * llamador no pueda borrar ese filtro:
   * - `where()` se comporta como `andWhere()`;
   * - `orWhere()` lanza error: `a AND b OR c` trae filas de cualquier negocio.
   *   Las condiciones OR van dentro de `andWhere(new Brackets(...))`.
   */
  createQueryBuilder(alias: string): SelectQueryBuilder<T> {
    const idNegocio = this.idNegocio();
    const qb = this.repositorio.createQueryBuilder(alias);
    qb.where(`${alias}.idNegocio = :${PARAMETRO_NEGOCIO}`, {
      [PARAMETRO_NEGOCIO]: idNegocio,
    });
    const andWhere = qb.andWhere.bind(qb);
    return Object.assign(qb, {
      where: andWhere,
      orWhere: (): never => {
        throw new Error(
          'orWhere() no se permite en el QueryBuilder de NegocioRepository: ' +
            'rompería el filtro por negocio. Use andWhere(new Brackets(...)) ' +
            'con las condiciones OR dentro.',
        );
      },
    });
  }

  private idNegocio(): number {
    const idNegocio = this.contexto.obtenerIdNegocio();
    if (idNegocio === undefined) {
      throw new ForbiddenException('Esta operación requiere un negocio.');
    }
    return idNegocio;
  }

  private conNegocio(where?: Where<T>): Where<T> {
    const filtro = { idNegocio: this.idNegocio() } as FindOptionsWhere<T>;
    if (Array.isArray(where)) {
      return where.length > 0
        ? where.map((w) => ({ ...w, ...filtro }))
        : filtro;
    }
    return { ...where, ...filtro };
  }
}
