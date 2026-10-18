import { ApiProperty } from '@nestjs/swagger';

/** Estados del login con 2FA pendiente: traen solo el token temporal. */
export const ESTADOS_2FA = ['CONFIGURAR_2FA', 'VERIFICAR_2FA'] as const;
export type Estado2fa = (typeof ESTADOS_2FA)[number];

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

/** Sesión abierta: contrato de `architecture.md` §11. */
export class RespuestaSesionDto {
  @ApiProperty({ enum: ['OK'], example: 'OK' })
  estado!: 'OK';

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

/**
 * Clave correcta con 2FA pendiente (decisión 50): sin sesión ni datos del
 * usuario, solo el token temporal para `/api/auth/2fa/*`.
 */
export class RespuestaDosFactoresDto {
  /** `CONFIGURAR_2FA`: falta enrolar (admin). `VERIFICAR_2FA`: falta el código. */
  @ApiProperty({ enum: ESTADOS_2FA, example: 'VERIFICAR_2FA' })
  estado!: Estado2fa;

  /** JWT de 5 min con `proposito: '2fa'`; solo sirve en `/api/auth/2fa/*`. */
  tokenTemporal!: string;
}

/** Respuesta del login: unión discriminada por `estado`. */
export type RespuestaLogin = RespuestaSesionDto | RespuestaDosFactoresDto;
