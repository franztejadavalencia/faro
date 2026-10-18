import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Solo el formato: la política de claves (`errorDeClave`) aplica al crearlas. */
export class LoginDto {
  /** Login, único en la plataforma; no distingue mayúsculas. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  usuario!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  clave!: string;
}
