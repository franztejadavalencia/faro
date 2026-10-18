import { Column } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Toda tabla de un negocio hereda de aquí (`architecture.md` §6). Solo la
 * columna: la FK a `negocio` la declara cada entidad concreta, porque `common/`
 * no importa dominios. Las entidades de plataforma (`persona`, `usuario`,
 * `rol_usuario`) redeclaran `idNegocio` como nullable.
 */
export abstract class BaseNegocioEntity extends BaseEntity {
  @Column({ name: 'id_negocio', type: 'integer' })
  idNegocio!: number;
}
