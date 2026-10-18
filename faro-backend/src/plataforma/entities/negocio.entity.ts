import { Check, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '@common/entities';

export const ESTADOS_NEGOCIO = ['ACTIVO', 'SUSPENDIDO'] as const;
export type EstadoNegocio = (typeof ESTADOS_NEGOCIO)[number];

/**
 * El negocio (tenant). Mínimo de B3: D1 le agrega NIT, valuación, prorrateo y
 * `fecha_inicio`. No hereda de `BaseNegocioEntity`: es el propio negocio.
 */
@Entity('negocio')
@Check('ck_negocio_estado', `"estado" IN ('ACTIVO', 'SUSPENDIDO')`)
export class Negocio extends BaseEntity {
  @PrimaryGeneratedColumn({
    name: 'id_negocio',
    primaryKeyConstraintName: 'pk_negocio',
  })
  idNegocio!: number;

  @Column({ type: 'varchar', length: 200 })
  nombre!: string;

  /** `SUSPENDIDO` bloquea el acceso de todos sus usuarios (decisión 30). */
  @Column({ type: 'varchar', length: 20, default: 'ACTIVO' })
  estado!: EstadoNegocio;
}
