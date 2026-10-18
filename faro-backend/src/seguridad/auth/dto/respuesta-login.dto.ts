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

  /** Nombre del rol: `Dueño`, `Empleado`, uno propio o `Administrador de plataforma`. */
  @ApiProperty({ type: String, nullable: true, example: 'Dueño' })
  rol!: string | null;
}

export class PermisoSesionDto {
  /** Código del módulo, p. ej. `productos`. */
  modulo!: string;
  /** Código de la opción, p. ej. `ver_costos`. */
  opcion!: string;
}

/** Nodo del menú del rol: un grupo (con `hijos`, sin `route`) o un módulo. */
export class ItemMenuDto {
  codigo!: string;
  nombre!: string;
  /** Ruta del frontend; `null` en un grupo. */
  @ApiProperty({ type: String, nullable: true, example: '/productos' })
  route!: string | null;
  /** Nombre de Material Symbols. */
  icono!: string;
  @ApiProperty({ type: () => [ItemMenuDto], required: false })
  hijos?: ItemMenuDto[];
}

/**
 * Lo que cambia con el rol: usuario, menú y permisos de ahora. Es el cuerpo de
 * `GET /api/auth/sesion` y parte de la sesión del login.
 */
export class SesionActualDto {
  usuario!: UsuarioSesionDto;

  /** Árbol del menú del rol (módulos con `ver`, agrupados), ya ordenado. */
  @ApiProperty({ type: [ItemMenuDto] })
  menu!: ItemMenuDto[];

  /** Permisos activos del rol. */
  @ApiProperty({ type: [PermisoSesionDto] })
  permisos!: PermisoSesionDto[];
}

/** Sesión abierta: contrato de `architecture.md` §11. */
export class RespuestaSesionDto extends SesionActualDto {
  @ApiProperty({ enum: ['OK'], example: 'OK' })
  estado!: 'OK';

  /** JWT de sesión (12 h). Va en `Authorization: Bearer …`. */
  token!: string;
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
