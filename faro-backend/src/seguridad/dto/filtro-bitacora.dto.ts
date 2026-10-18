import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginacionDto } from '@common/dto/paginacion.dto';
import { EVENTOS_BITACORA } from '../constants/eventos-bitacora';

/** Filtros de `GET /api/bitacora`. El negocio sale del contexto, nunca de aquí. */
export class FiltroBitacoraDto extends PaginacionDto {
  /** Solo los eventos de este usuario del negocio. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idUsuario?: number;

  /** Un evento de `GET /api/bitacora/eventos`. */
  @IsOptional()
  @IsString()
  @IsIn(Object.values(EVENTOS_BITACORA))
  evento?: string;

  /** `AAAA-MM-DD`, inclusivo, en la zona horaria del sistema. */
  @IsOptional()
  @IsISO8601({ strict: true })
  desde?: string;

  /** `AAAA-MM-DD`, inclusivo, en la zona horaria del sistema. */
  @IsOptional()
  @IsISO8601({ strict: true })
  hasta?: string;
}

export class UsuarioBitacoraDto {
  id!: number;
  nombre!: string;
}

export class RegistroBitacoraDto {
  id!: number;
  fecha!: Date;
  evento!: string;
  /** `null` si el evento no tiene usuario. */
  usuario!: UsuarioBitacoraDto | null;
  ip!: string | null;
  detalle!: Record<string, unknown> | null;
  url!: string | null;
  metodo!: string | null;
}

export class PaginaBitacoraDto {
  items!: RegistroBitacoraDto[];
  total!: number;
  pagina!: number;
  tamano!: number;
}
