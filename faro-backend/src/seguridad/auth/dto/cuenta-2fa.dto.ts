import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Reautenticación para tocar la configuración del segundo factor (OWASP MFA
 * Cheat Sheet): la clave actual, como el *sudo mode* de GitHub.
 */
export class ConfigurarCuenta2faDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  clave!: string;
}

/** El primer código de la app, que prueba que el teléfono es de quien configura. */
export class ActivarCuenta2faDto {
  /** Código de 6 dígitos de la app autenticadora. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  codigo!: string;
}

/** Clave actual **y** un segundo factor, para desactivar la 2FA o regenerar los códigos. */
export class ReautenticarCuenta2faDto extends ConfigurarCuenta2faDto {
  /** Código de 6 dígitos de la app o un código de respaldo (`XXXXX-XXXXX`). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  codigo!: string;
}

export class EstadoCuenta2faDto {
  activo!: boolean;
  /** Códigos de respaldo sin usar. */
  codigosRespaldoRestantes!: number;
}

export class RespuestaCodigosRespaldoDto {
  /** 10 códigos `XXXXX-XXXXX` de un solo uso. No se vuelven a mostrar. */
  codigosRespaldo!: string[];
}
