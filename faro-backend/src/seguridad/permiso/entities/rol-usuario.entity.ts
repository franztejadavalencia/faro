import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseNegocioOpcionalEntity } from '@common/entities';
import { Negocio } from '@plataforma/entities/negocio.entity';

/**
 * Rol de un negocio (`id_negocio` = el negocio) o de plataforma (`NULL`,
 * decisión 44). El Dueño y el rol de plataforma son `es_fijo`: el servicio
 * rechaza editarlos o borrarlos. El único `(id_negocio, lower(nombre))` con
 * `NULLS NOT DISTINCT` vive en la migración (TypeORM no declara índices de
 * expresión; el `synchronize: false` lo excluye del `migration:generate`,
 * decisión 83).
 */
@Entity('rol_usuario')
@Index('uq_rol_usuario_nombre', { synchronize: false })
export class RolUsuario extends BaseNegocioOpcionalEntity {
  @PrimaryGeneratedColumn({
    name: 'id_rol_usuario',
    primaryKeyConstraintName: 'pk_rol_usuario',
  })
  idRolUsuario!: number;

  @ManyToOne(() => Negocio, { nullable: true })
  @JoinColumn({
    name: 'id_negocio',
    foreignKeyConstraintName: 'fk_rol_usuario_negocio',
  })
  negocio?: Negocio | null;

  @Column({ type: 'varchar', length: 100 })
  nombre!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  descripcion!: string | null;

  @Column({ name: 'es_fijo', type: 'boolean', default: false })
  esFijo!: boolean;
}
