import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '@common/entities';

/** Catálogo global de opciones de permiso (decisión 49); solo por migración. */
@Entity('opcion_modulo_sistema')
@Index('uq_opcion_modulo_sistema_codigo', ['codigo'], { unique: true })
export class OpcionModuloSistema extends BaseEntity {
  @PrimaryGeneratedColumn({
    name: 'id_opcion_modulo_sistema',
    primaryKeyConstraintName: 'pk_opcion_modulo_sistema',
  })
  idOpcionModuloSistema!: number;

  @Column({ type: 'varchar', length: 30 })
  codigo!: string;

  @Column({ type: 'varchar', length: 50 })
  nombre!: string;

  @Column({ type: 'integer' })
  orden!: number;
}
