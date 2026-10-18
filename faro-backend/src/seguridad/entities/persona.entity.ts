import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseNegocioOpcionalEntity } from '@common/entities';
import { Negocio } from '@plataforma/entities/negocio.entity';

export const TIPOS_PERSONA = ['NATURAL', 'JURIDICA'] as const;
export type TipoPersona = (typeof TIPOS_PERSONA)[number];

export const TIPOS_DOCUMENTO = ['CI', 'NIT', 'OTRO'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

/**
 * Ficha única por negocio (decisión 43): una persona puede ser empleado con
 * usuario y proveedor a la vez. Las de los usuarios de plataforma no tienen
 * negocio.
 */
@Entity('persona')
@Index('uq_persona_documento', ['idNegocio', 'tipoDocumento', 'documento'], {
  unique: true,
  where: 'documento IS NOT NULL AND id_estado = 1',
})
@Check('ck_persona_tipo', `"tipo" IN ('NATURAL', 'JURIDICA')`)
@Check(
  'ck_persona_tipo_documento',
  `"tipo_documento" IS NULL OR "tipo_documento" IN ('CI', 'NIT', 'OTRO')`,
)
@Check(
  'ck_persona_documento_completo',
  `("tipo_documento" IS NULL) = ("documento" IS NULL)`,
)
@Check(
  'ck_persona_apellidos_natural',
  `"tipo" = 'NATURAL' OR ("paterno" IS NULL AND "materno" IS NULL)`,
)
export class Persona extends BaseNegocioOpcionalEntity {
  @PrimaryGeneratedColumn({
    name: 'id_persona',
    primaryKeyConstraintName: 'pk_persona',
  })
  idPersona!: number;

  @ManyToOne(() => Negocio, { nullable: true })
  @JoinColumn({
    name: 'id_negocio',
    foreignKeyConstraintName: 'fk_persona_negocio',
  })
  negocio?: Negocio | null;

  @Column({ type: 'varchar', length: 10 })
  tipo!: TipoPersona;

  /** Nombre, o razón social si es jurídica. */
  @Column({ type: 'varchar', length: 200 })
  nombre!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  paterno!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  materno!: string | null;

  @Column({
    name: 'tipo_documento',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  tipoDocumento!: TipoDocumento | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  documento!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  correo!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono!: string | null;
}
