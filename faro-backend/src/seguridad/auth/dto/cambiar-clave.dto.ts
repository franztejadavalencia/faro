import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * El usuario sale del token, nunca de la ruta ni del body. La política de la
 * clave nueva (`errorDeClave`) la aplica el servicio, con su mensaje.
 */
export class CambiarClaveDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  claveActual!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  claveNueva!: string;
}
