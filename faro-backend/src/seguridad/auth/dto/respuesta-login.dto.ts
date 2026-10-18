import { ApiProperty } from '@nestjs/swagger';

/** B5 agrega `CONFIGURAR_2FA` y `VERIFICAR_2FA` (sin token de sesión). */
export const ESTADOS_LOGIN = ['OK'] as const;
export type EstadoLogin = (typeof ESTADOS_LOGIN)[number];

export class NegocioSesionDto {
  id!: number;
  nombre!: string;
}

export class UsuarioSesionDto {
  id!: number;

  /** `nombreCompleto(persona)`. */
  nombre!: string;

  /** Con `true`, solo sirve `POST /api/auth/cambiar-clave` (decisión 48). */
  debeCambiarClave!: boolean;

  /** `null` para el admin de plataforma. */
  @ApiProperty({ type: NegocioSesionDto, nullable: true })
  negocio!: NegocioSesionDto | null;

  /** Nombre del rol. `null` hasta B6, que crea los roles. */
  @ApiProperty({ type: String, nullable: true, example: null })
  rol!: string | null;
}

export class PermisoSesionDto {
  modulo!: string;
  opcion!: string;
}

/** Contrato de `architecture.md` §11. */
export class RespuestaLoginDto {
  @ApiProperty({ enum: ESTADOS_LOGIN, example: 'OK' })
  estado!: EstadoLogin;

  /** JWT de sesión (12 h). Va en `Authorization: Bearer …`. */
  token!: string;

  usuario!: UsuarioSesionDto;

  /** Árbol del menú del rol. Vacío hasta B6. */
  @ApiProperty({ type: 'array', items: { type: 'object' }, example: [] })
  menu!: Record<string, unknown>[];

  /** Vacío hasta B6. */
  @ApiProperty({ type: [PermisoSesionDto], example: [] })
  permisos!: PermisoSesionDto[];
}
