import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class NotasDto {
  @IsOptional()
  @IsString()
  @MaxLength(255, {
    message: 'Las notas deben tener como máximo 255 caracteres',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  notas!: string | null;
}
