import { Column } from 'typeorm';
import { BaseNegocioEntity } from './base-negocio.entity';

/**
 * Registro que tuvo efecto y, al corregirlo, queda como rastro. `id_estado`
 * sigue siendo solo «activo / eliminado»; la anulación es este campo propio,
 * igual en todo el sistema. Un registro anulado es inmutable y no cuenta en
 * ningún cálculo: toda consulta de «activos» usa `id_estado = 1 AND NOT
 * anulado` (`@common/utils/anulacion.util`). El motivo es obligatorio al
 * anular (lo valida el servicio; sin `CHECK`).
 */
export abstract class BaseAnulableEntity extends BaseNegocioEntity {
  @Column({ type: 'boolean', default: false })
  anulado!: boolean;

  @Column({ name: 'fecha_anulacion', type: 'timestamptz', nullable: true })
  fechaAnulacion!: Date | null;

  @Column({ name: 'usuario_anulacion', type: 'integer', nullable: true })
  usuarioAnulacion!: number | null;

  @Column({
    name: 'motivo_anulacion',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  motivoAnulacion!: string | null;
}
