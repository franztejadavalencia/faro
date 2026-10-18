import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ModuloSistema } from './modulo-sistema.entity';
import { OpcionModuloSistema } from './opcion-modulo-sistema.entity';

/**
 * Pares válidos módulo × opción (decisión 99): la matriz de permisos solo tiene
 * casillas de esta tabla, y `permiso_rol_usuario` la referencia con una FK
 * compuesta, así que la base no admite un permiso que el módulo no tiene.
 * Catálogo: solo por migración.
 */
@Entity('modulo_opcion_sistema')
export class ModuloOpcionSistema {
  @PrimaryColumn({
    name: 'id_modulo_sistema',
    type: 'integer',
    primaryKeyConstraintName: 'pk_modulo_opcion_sistema',
  })
  idModuloSistema!: number;

  @PrimaryColumn({
    name: 'id_opcion_modulo_sistema',
    type: 'integer',
    primaryKeyConstraintName: 'pk_modulo_opcion_sistema',
  })
  idOpcionModuloSistema!: number;

  @ManyToOne(() => ModuloSistema, { nullable: false })
  @JoinColumn({
    name: 'id_modulo_sistema',
    foreignKeyConstraintName: 'fk_modulo_opcion_modulo',
  })
  modulo?: ModuloSistema;

  @ManyToOne(() => OpcionModuloSistema, { nullable: false })
  @JoinColumn({
    name: 'id_opcion_modulo_sistema',
    foreignKeyConstraintName: 'fk_modulo_opcion_opcion',
  })
  opcion?: OpcionModuloSistema;
}
