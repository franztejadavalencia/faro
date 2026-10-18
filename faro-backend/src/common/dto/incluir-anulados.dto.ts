import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/** Filtro común de los listados con anulados: por defecto solo los activos. */
export class IncluirAnuladosDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  incluirAnulados?: boolean;
}
