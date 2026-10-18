import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class MotivoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255, {
    message: 'El motivo debe tener como máximo 255 caracteres',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  motivo!: string;
}
