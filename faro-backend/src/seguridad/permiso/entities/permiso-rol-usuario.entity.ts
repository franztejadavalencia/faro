import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseEntity } from '@common/entities';
import { ModuloOpcionSistema } from './modulo-opcion-sistema.entity';
import { RolUsuario } from './rol-usuario.entity';

/**
 * Permiso de un rol sobre un par módulo × opción. No lleva `id_negocio`: cuelga
 * del rol, y a un rol solo se llega con `NegocioRepository` (el servicio
 * comprueba el rol antes de tocar sus permisos). La FK compuesta al par exige
 * que la opción exista en ese módulo.
 */
@Entity('permiso_rol_usuario')
@Index(
  'uq_permiso_rol_usuario',
  ['idRolUsuario', 'idModuloSistema', 'idOpcionModuloSistema'],
  { unique: true },
)
export class PermisoRolUsuario extends BaseEntity {
  @PrimaryGeneratedColumn({
    name: 'id_permiso_rol_usuario',
    primaryKeyConstraintName: 'pk_permiso_rol_usuario',
  })
  idPermisoRolUsuario!: number;

  @Column({ name: 'id_rol_usuario', type: 'integer' })
  idRolUsuario!: number;

  @ManyToOne(() => RolUsuario, { nullable: false })
  @JoinColumn({
    name: 'id_rol_usuario',
    foreignKeyConstraintName: 'fk_permiso_rol_usuario_rol',
  })
  rolUsuario?: RolUsuario;

  @Column({ name: 'id_modulo_sistema', type: 'integer' })
  idModuloSistema!: number;

  @Column({ name: 'id_opcion_modulo_sistema', type: 'integer' })
  idOpcionModuloSistema!: number;

  @ManyToOne(() => ModuloOpcionSistema, { nullable: false })
  @JoinColumn([
    {
      name: 'id_modulo_sistema',
      referencedColumnName: 'idModuloSistema',
      foreignKeyConstraintName: 'fk_permiso_rol_usuario_par',
    },
    {
      name: 'id_opcion_modulo_sistema',
      referencedColumnName: 'idOpcionModuloSistema',
      foreignKeyConstraintName: 'fk_permiso_rol_usuario_par',
    },
  ])
  par?: ModuloOpcionSistema;

  @Column({ type: 'boolean' })
  activo!: boolean;
}
