import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Negocio } from '@plataforma/entities/negocio.entity';
import { Usuario } from './usuario.entity';

/**
 * Bitácora de solo inserción (decisión 51): el trigger
 * `tr_bitacora_solo_insercion` rechaza UPDATE y DELETE. No hereda de
 * `BaseEntity` ni de `BaseNegocioEntity` (una fila inmutable no tiene fecha de
 * modificación): por eso `NegocioRepository` no la acepta. Toda lectura y
 * escritura pasa por `BitacoraService` (B4 y B7), que toma negocio y usuario del
 * contexto, nunca del cliente.
 */
@Entity('bitacora')
@Index('ix_bitacora_negocio_fecha', ['idNegocio', 'fecha'])
@Index('ix_bitacora_usuario_fecha', ['idUsuario', 'fecha'])
export class Bitacora {
  @PrimaryGeneratedColumn({
    name: 'id_bitacora',
    primaryKeyConstraintName: 'pk_bitacora',
  })
  idBitacora!: number;

  /** `null` en eventos de plataforma. */
  @Column({ name: 'id_negocio', type: 'integer', nullable: true })
  idNegocio!: number | null;

  @ManyToOne(() => Negocio, { nullable: true })
  @JoinColumn({
    name: 'id_negocio',
    foreignKeyConstraintName: 'fk_bitacora_negocio',
  })
  negocio?: Negocio | null;

  /** `null` en un login fallido sin usuario conocido. */
  @Column({ name: 'id_usuario', type: 'integer', nullable: true })
  idUsuario!: number | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({
    name: 'id_usuario',
    foreignKeyConstraintName: 'fk_bitacora_usuario',
  })
  usuario?: Usuario | null;

  @Column({ type: 'varchar', length: 100 })
  evento!: string;

  @Column({ type: 'jsonb', nullable: true })
  detalle!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'text', nullable: true })
  url!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  metodo!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  fecha!: Date;
}
