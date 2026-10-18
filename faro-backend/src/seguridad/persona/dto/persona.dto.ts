import { PartialType, PickType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TIPOS_DOCUMENTO, TipoDocumento } from '../../entities/persona.entity';

const recortar = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Alta de una persona (natural) en el mismo formulario del usuario (decisión 43). */
export class PersonaNuevaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(recortar)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(recortar)
  paterno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(recortar)
  materno?: string;

  /** Va junto con `documento`: los dos o ninguno. */
  @IsOptional()
  @IsIn(TIPOS_DOCUMENTO)
  tipoDocumento?: TipoDocumento;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Transform(recortar)
  documento?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  @Transform(recortar)
  correo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(recortar)
  telefono?: string;
}

/** Lo que cambia de una persona ya existente: el documento no cambia (B7). */
export class ContactoPersonaDto extends PartialType(
  PickType(PersonaNuevaDto, [
    'nombre',
    'paterno',
    'materno',
    'correo',
    'telefono',
  ] as const),
) {}

export class BuscarPersonaDto {
  /** Documento o nombre (mínimo 2 caracteres). */
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(recortar)
  q!: string;
}

export class PersonaBuscadaDto {
  idPersona!: number;
  nombre!: string;
  tipoDocumento!: TipoDocumento | null;
  documento!: string | null;
  correo!: string | null;
  telefono!: string | null;
  /** Ya tiene un usuario activo: no puede recibir otro. */
  tieneUsuario!: boolean;
}
