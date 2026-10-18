import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';

/** Códigos de respaldo de la 2FA: de un solo uso y con hash (decisión 50). */
@Entity('usuario_codigo_respaldo')
@Index('ix_codigo_respaldo_usuario', ['idUsuario'])
export class UsuarioCodigoRespaldo {
  @PrimaryGeneratedColumn({
    name: 'id_usuario_codigo_respaldo',
    primaryKeyConstraintName: 'pk_usuario_codigo_respaldo',
  })
  idUsuarioCodigoRespaldo!: number;

  @Column({ name: 'id_usuario', type: 'integer' })
  idUsuario!: number;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({
    name: 'id_usuario',
    foreignKeyConstraintName: 'fk_codigo_respaldo_usuario',
  })
  usuario?: Usuario;

  @Column({ type: 'varchar', length: 100 })
  hash!: string;

  @Column({ name: 'usado_en', type: 'timestamptz', nullable: true })
  usadoEn!: Date | null;

  @CreateDateColumn({ name: 'fecha_registro', type: 'timestamptz' })
  fechaRegistro!: Date;
}
