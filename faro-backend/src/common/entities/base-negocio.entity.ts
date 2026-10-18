import { Column } from 'typeorm';
import { BaseConNegocioEntity } from './base-con-negocio.entity';

/**
 * Toda tabla de un negocio hereda de aquí (`architecture.md` §6): `id_negocio`
 * `NOT NULL`. Solo la columna: la FK a `negocio` la declara cada entidad
 * concreta, porque `common/` no importa dominios. Las tablas que también pueden
 * ser de plataforma (`persona`, `usuario`, `rol_usuario`) heredan de
 * `BaseNegocioOpcionalEntity`.
 */
export abstract class BaseNegocioEntity extends BaseConNegocioEntity {
  @Column({ name: 'id_negocio', type: 'integer' })
  idNegocio!: number;
}
