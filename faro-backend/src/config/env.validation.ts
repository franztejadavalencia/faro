// Los decoradores de class-transformer leen metadata; fuera de Nest (CLI de
// TypeORM, globalSetup de los e2e, unit tests) nadie más la carga.
import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

export const JWT_SECRET_MIN_CARACTERES = 32;

export enum Entorno {
  Desarrollo = 'development',
  Prueba = 'test',
  Produccion = 'production',
}

/** Variables de `.env.${NODE_ENV}`. Si una no cumple, la app no arranca. */
export class VariablesEntorno {
  @IsEnum(Entorno)
  NODE_ENV: Entorno = Entorno.Desarrollo;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  DB_HOST!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT!: number;

  @IsString()
  @IsNotEmpty()
  DB_NAME!: string;

  @IsString()
  @IsNotEmpty()
  DB_USER!: string;

  @IsString()
  DB_PASSWORD!: string;

  /**
   * Firma los JWT con HS256: la clave debe tener al menos 256 bits (RFC 7518
   * §3.2). Con una corta la app no arranca.
   */
  @IsString()
  @MinLength(JWT_SECRET_MIN_CARACTERES, {
    message: `JWT_SECRET debe tener al menos ${JWT_SECRET_MIN_CARACTERES} caracteres (genera uno con: node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")`,
  })
  JWT_SECRET!: string;

  /** Uno o varios orígenes separados por coma. */
  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN!: string;

  /** Obligatoria desde B5, cuando se cifre `totp_secreto`. */
  @IsOptional()
  @IsString()
  TOTP_CLAVE_CIFRADO?: string;

  /**
   * Vacío = sin proxy (se usa `request.ip`). Con valor, va a `trust proxy` de
   * Express: saltos (`1`), `loopback`, IPs o subredes. `true` confiaría en
   * cualquier cabecera `x-forwarded-for` (decisión 51).
   */
  @ValidateIf((_, valor) => valor !== undefined && valor !== '')
  @IsString()
  @Matches(/^(?!\s*true\s*$)/i, {
    message:
      'TRUST_PROXY no acepta true: confía en cualquier x-forwarded-for. Usa el número de proxies (p. ej. 1), loopback o sus IPs',
  })
  @Matches(/^(?!\s*false\s*$)/i, {
    message: 'TRUST_PROXY no acepta false: déjalo vacío para desactivarlo',
  })
  TRUST_PROXY?: string;

  /**
   * Admin de plataforma (`npm run seed:admin`). Opcionales para la app: solo las
   * exige el seed. En producción se borra `ADMIN_CLAVE` del `.env` tras sembrar.
   */
  @IsOptional()
  @IsString()
  ADMIN_USUARIO?: string;

  @IsOptional()
  @IsString()
  ADMIN_CLAVE?: string;

  @IsOptional()
  @IsString()
  ADMIN_NOMBRE?: string;

  /** Solo cuenta en producción: Swagger se publica allí solo con `true`. */
  @IsOptional()
  @IsIn(['', 'true', 'false'])
  SWAGGER?: string;
}

export function validarEntorno(
  config: Record<string, unknown>,
): VariablesEntorno {
  const variables = plainToInstance(VariablesEntorno, config);
  const errores = validateSync(variables);
  if (errores.length > 0) {
    const detalle = errores
      .map(
        (e) =>
          `${e.property}: ${Object.values(e.constraints ?? {}).join('; ')}`,
      )
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${detalle}`);
  }
  return variables;
}

/** Valor para `app.set('trust proxy', …)`, o `null` si no hay proxy. */
export function valorTrustProxy(
  trustProxy: string | undefined,
): string | number | null {
  const valor = trustProxy?.trim();
  if (!valor) return null;
  return /^\d+$/.test(valor) ? Number(valor) : valor;
}

export function swaggerHabilitado(
  entorno: Entorno,
  swagger: string | undefined,
): boolean {
  return entorno !== Entorno.Produccion || swagger === 'true';
}

export function origenesCors(corsOrigin: string): string[] {
  return corsOrigin
    .split(',')
    .map((origen) => origen.trim())
    .filter((origen) => origen !== '');
}
