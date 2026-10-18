import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const TAMANO_PAGINA_POR_DEFECTO = 50;
/** Tope: una consulta sin límite es una forma de agotar el servidor (OWASP API4:2023). */
export const TAMANO_PAGINA_MAXIMO = 100;

/** Paginación de los listados que pueden crecer: `pagina` desde 1. */
export class PaginacionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TAMANO_PAGINA_MAXIMO)
  tamano?: number;
}

export interface PaginaDe<T> {
  items: T[];
  total: number;
  pagina: number;
  tamano: number;
}
