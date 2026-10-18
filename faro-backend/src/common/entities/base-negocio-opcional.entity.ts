import { Column } from 'typeorm';
import { BaseConNegocioEntity } from './base-con-negocio.entity';

/**
 * Como `BaseNegocioEntity`, pero `id_negocio` admite `NULL`: filas de
 * plataforma (el admin y su persona, el rol de plataforma). Solo para tablas
 * que pueden ser de plataforma (`persona`, `usuario`, `rol_usuario`); cualquier
 * otra lo justifica en su revisión (decisión 81).
 */
export abstract class BaseNegocioOpcionalEntity extends BaseConNegocioEntity {
  @Column({ name: 'id_negocio', type: 'integer', nullable: true })
  idNegocio!: number | null;
}
