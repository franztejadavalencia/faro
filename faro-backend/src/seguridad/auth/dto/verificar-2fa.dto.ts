import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class Verificar2faDto {
  /** Código de 6 dígitos de la app o un código de respaldo (`XXXXX-XXXXX`). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  codigo!: string;
}
