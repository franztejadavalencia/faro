import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CrearRolDto {
  /** Único en el negocio, sin distinguir mayúsculas. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(recortar)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(recortar)
  descripcion?: string;
}

export class ActualizarRolDto extends PartialType(CrearRolDto) {}

export class PermisoDto {
  /** Código del módulo, p. ej. `productos`. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  modulo!: string;

  /** Código de la opción, p. ej. `ver_costos`. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  opcion!: string;
}

export class ActualizarPermisosDto {
  /**
   * El conjunto **completo** de permisos activos del rol: todo par que no
   * aparezca queda inactivo. Solo pares que existan en el catálogo.
   */
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PermisoDto)
  permisos!: PermisoDto[];
}

export class RolDto {
  idRolUsuario!: number;
  nombre!: string;
  descripcion!: string | null;
  /** Los roles fijos (Dueño) no se editan ni se borran. */
  esFijo!: boolean;
}

export class OpcionMatrizDto {
  codigo!: string;
  nombre!: string;
  activo!: boolean;
}

export class ModuloMatrizDto {
  codigo!: string;
  nombre!: string;
  /** Grupo del menú; `null` si el módulo es de nivel superior. */
  grupo!: string | null;
  opciones!: OpcionMatrizDto[];
}

export class MatrizRolDto {
  rol!: RolDto;
  /** Solo las casillas que existen (módulo × opciones válidas). */
  modulos!: ModuloMatrizDto[];
}
