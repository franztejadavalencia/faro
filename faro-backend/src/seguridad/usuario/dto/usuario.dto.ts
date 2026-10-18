import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ContactoPersonaDto,
  PersonaNuevaDto,
} from '../../persona/dto/persona.dto';
import { TipoDocumento } from '../../entities/persona.entity';

const recortar = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const ESTADOS_USUARIO = ['ACTIVOS', 'INACTIVOS', 'TODOS'] as const;
export type EstadoUsuario = (typeof ESTADOS_USUARIO)[number];

export class FiltroUsuariosDto {
  /** Por defecto, solo los activos. */
  @IsOptional()
  @IsIn(ESTADOS_USUARIO)
  estado?: EstadoUsuario;
}

export class CrearUsuarioDto {
  /** Una persona que ya existe en el negocio. Excluye a `persona`. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idPersona?: number;

  /** Alta de la persona en el mismo formulario. Excluye a `idPersona`. */
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonaNuevaDto)
  persona?: PersonaNuevaDto;

  /**
   * Login, único en **toda la plataforma** (decisión 43); se recomienda el
   * correo. No distingue mayúsculas.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^\S+$/, { message: 'El usuario no puede llevar espacios.' })
  @Transform(recortar)
  usuario!: string;

  /** Mínimo 8 caracteres. El empleado debe cambiarla en su primer ingreso (decisión 48). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  claveTemporal!: string;

  /** Un rol del negocio, que no sea el fijo y que el editor cubra (decisión 99). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idRolUsuario!: number;
}

export class ActualizarUsuarioDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idRolUsuario?: number;

  /** Nombre y datos de contacto de la persona; el documento no cambia. */
  @IsOptional()
  @ValidateNested()
  @Type(() => ContactoPersonaDto)
  persona?: ContactoPersonaDto;
}

export class RestablecerClaveDto {
  /** Mínimo 8 caracteres. Deja `debeCambiarClave` y cierra sus sesiones. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  claveTemporal!: string;
}

export class RolDeUsuarioDto {
  idRolUsuario!: number;
  nombre!: string;
  esFijo!: boolean;
}

export class PersonaDeUsuarioDto {
  idPersona!: number;
  nombre!: string;
  paterno!: string | null;
  materno!: string | null;
  tipoDocumento!: TipoDocumento | null;
  documento!: string | null;
  correo!: string | null;
  telefono!: string | null;
}

/** Nunca lleva la clave ni el secreto TOTP. */
export class UsuarioDto {
  idUsuario!: number;
  /** El login. */
  usuario!: string;
  /** `nombreCompleto(persona)`. */
  nombre!: string;
  activo!: boolean;
  /** Bloqueo temporal vigente (decisión 53). */
  bloqueado!: boolean;
  debeCambiarClave!: boolean;
  totpActivo!: boolean;
  rol!: RolDeUsuarioDto;
  persona!: PersonaDeUsuarioDto;
}
