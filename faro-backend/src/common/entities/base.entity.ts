import { Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Columnas comunes de toda entidad. `timestamptz` (decisión 75): el instante es
 * inequívoco aunque cambie la zona del proceso de Node o del servidor.
 */
export class BaseEntity {
  @CreateDateColumn({ name: 'fecha_registro', type: 'timestamptz' })
  fechaRegistro!: Date;

  @UpdateDateColumn({ name: 'fecha_modificacion', type: 'timestamptz' })
  fechaModificacion!: Date;

  @Column({ name: 'id_estado', type: 'integer', default: 1 })
  idEstado!: number;

  @Column({ name: 'usuario_registro', type: 'integer', nullable: true })
  usuarioRegistro!: number | null;

  @Column({ name: 'usuario_modificacion', type: 'integer', nullable: true })
  usuarioModificacion!: number | null;
}
