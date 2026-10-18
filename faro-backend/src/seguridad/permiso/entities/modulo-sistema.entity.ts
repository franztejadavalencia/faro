import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseEntity } from '@common/entities';
import { Ambito } from '../constants/catalogo';

export const TIPOS_MODULO = ['GRUPO', 'MENU'] as const;
export type TipoModulo = (typeof TIPOS_MODULO)[number];

/**
 * Catálogo global de módulos (decisión 45): sus filas solo cambian por
 * migración. Un `GRUPO` es un nodo del menú sin permisos propios; un `MENU` es
 * un módulo hoja, con opciones (`modulo_opcion_sistema`). `ambito` separa lo que
 * ve un negocio de lo que ve la plataforma (decisión 99).
 */
@Entity('modulo_sistema')
@Index('uq_modulo_sistema_codigo', ['codigo'], { unique: true })
@Check('ck_modulo_sistema_tipo', `"tipo_modulo" IN ('GRUPO', 'MENU')`)
@Check('ck_modulo_sistema_ambito', `"ambito" IN ('NEGOCIO', 'PLATAFORMA')`)
export class ModuloSistema extends BaseEntity {
  @PrimaryGeneratedColumn({
    name: 'id_modulo_sistema',
    primaryKeyConstraintName: 'pk_modulo_sistema',
  })
  idModuloSistema!: number;

  @Column({ name: 'id_grupo_modulo_sistema', type: 'integer', nullable: true })
  idGrupoModuloSistema!: number | null;

  @ManyToOne(() => ModuloSistema, { nullable: true })
  @JoinColumn({
    name: 'id_grupo_modulo_sistema',
    foreignKeyConstraintName: 'fk_modulo_sistema_grupo',
  })
  grupo?: ModuloSistema | null;

  /** Estable: es lo que escribe `@RequierePermiso`. */
  @Column({ type: 'varchar', length: 50 })
  codigo!: string;

  @Column({ type: 'varchar', length: 100 })
  nombre!: string;

  @Column({ type: 'varchar', length: 200 })
  descripcion!: string;

  /** Ruta del frontend; `null` en un grupo. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  route!: string | null;

  /** Nombre de Material Symbols. */
  @Column({ type: 'varchar', length: 50 })
  icono!: string;

  @Column({ type: 'integer' })
  orden!: number;

  @Column({ name: 'tipo_modulo', type: 'varchar', length: 10 })
  tipoModulo!: TipoModulo;

  @Column({ type: 'varchar', length: 10 })
  ambito!: Ambito;
}
