import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { SoloAutenticado } from '../../permiso/decorators/solo-autenticado.decorator';
import { SoloTokenTemporal2fa } from '../decorators/solo-token-temporal-2fa.decorator';
import { Usuario2fa } from '../decorators/usuario-2fa.decorator';
import {
  RespuestaActivacion2faDto,
  RespuestaConfigurar2faDto,
} from '../dto/respuesta-2fa.dto';
import { RespuestaSesionDto } from '../dto/respuesta-login.dto';
import { Verificar2faDto } from '../dto/verificar-2fa.dto';
import { DosFactoresService } from '../services/dos-factores.service';

/**
 * Rutas de la 2FA (decisión 50). Solo aceptan el token temporal del login
 * (`Authorization: Bearer <tokenTemporal>`); el usuario sale de ese token,
 * nunca del body.
 */
@ApiTags('auth')
@SoloAutenticado()
@ApiBearerAuth()
@ApiExtraModels(RespuestaSesionDto, RespuestaActivacion2faDto)
@Controller('auth/2fa')
export class DosFactoresController {
  constructor(private readonly dosFactores: DosFactoresService) {}

  @Post('configurar')
  @SoloTokenTemporal2fa()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Genera el secreto TOTP (pendiente hasta el primer código) y devuelve el QR',
  })
  @ApiOkResponse({ type: RespuestaConfigurar2faDto })
  @ApiUnauthorizedResponse({
    description:
      'Sin token temporal válido (uno de sesión no sirve) o cuenta bloqueada',
  })
  @ApiConflictResponse({ description: 'La 2FA ya está activa' })
  configurar(
    @Usuario2fa() idUsuario: number,
  ): Promise<RespuestaConfigurar2faDto> {
    return this.dosFactores.configurar(idUsuario);
  }

  @Post('verificar')
  @SoloTokenTemporal2fa()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Verifica el código TOTP o uno de respaldo y abre la sesión; el primer código activa la 2FA',
  })
  @ApiOkResponse({
    description:
      'La sesión de §11. Al activar la 2FA, además `codigosRespaldo` (se muestran una sola vez)',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(RespuestaSesionDto) },
        { $ref: getSchemaPath(RespuestaActivacion2faDto) },
      ],
    },
  })
  @ApiBadRequestResponse({ description: 'Body con formato inválido' })
  @ApiUnauthorizedResponse({
    description:
      'Credenciales inválidas: código incorrecto o ya usado, cuenta bloqueada, o sin token temporal válido',
  })
  @ApiConflictResponse({ description: 'La 2FA se activó en otra petición' })
  verificar(
    @Usuario2fa() idUsuario: number,
    @Body() dto: Verificar2faDto,
  ): Promise<RespuestaSesionDto | RespuestaActivacion2faDto> {
    return this.dosFactores.verificar(idUsuario, dto.codigo);
  }
}
