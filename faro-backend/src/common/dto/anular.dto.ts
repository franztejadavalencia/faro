import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MOTIVO_ANULACION_MAX } from '../utils/anulacion.util';

/** Cuerpo de toda anulación: el motivo es obligatorio. */
export class AnularDto {
  @IsString()
  @IsNotEmpty({ message: 'Indique el motivo de la anulación' })
  @MaxLength(MOTIVO_ANULACION_MAX, {
    message: `El motivo debe tener como máximo ${MOTIVO_ANULACION_MAX} caracteres`,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  motivo!: string;
}
