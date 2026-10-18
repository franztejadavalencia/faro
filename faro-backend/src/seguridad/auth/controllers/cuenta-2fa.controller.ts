import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { SoloAutenticado } from '../../permiso/decorators/solo-autenticado.decorator';
import {
  ActivarCuenta2faDto,
  ConfigurarCuenta2faDto,
  EstadoCuenta2faDto,
  ReautenticarCuenta2faDto,
  RespuestaCodigosRespaldoDto,
} from '../dto/cuenta-2fa.dto';
import {
  RespuestaActivacion2faDto,
  RespuestaConfigurar2faDto,
} from '../dto/respuesta-2fa.dto';
import { RespuestaSesionDto } from '../dto/respuesta-login.dto';
import { Cuenta2faService } from '../services/cuenta-2fa.service';

/**
 * 2FA opcional del **dueño**, con sesión (decisión 97). Es una acción de la
 * propia cuenta, no un módulo del catálogo de permisos: `@SoloAutenticado` y el
 * servicio comprueba que sea el Dueño (403 al admin y a los empleados).
 */
@ApiTags('cuenta')
@ApiBearerAuth()
@SoloAutenticado()
@ApiForbiddenResponse({ description: 'No es el dueño de un negocio' })
@Controller('cuenta/2fa')
export class Cuenta2faController {
  constructor(private readonly cuenta: Cuenta2faService) {}

  @Get()
  @ApiOperation({ summary: 'Estado de la 2FA del dueño' })
  @ApiOkResponse({ type: EstadoCuenta2faDto })
  estado(): Promise<EstadoCuenta2faDto> {
    return this.cuenta.estado();
  }

  @Post('configurar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Genera el secreto pendiente y devuelve el QR (pide la clave actual)',
  })
  @ApiOkResponse({ type: RespuestaConfigurar2faDto })
  @ApiBadRequestResponse({ description: 'Clave incorrecta (suma al bloqueo)' })
  @ApiConflictResponse({ description: 'La 2FA ya está activa' })
  @ApiTooManyRequestsResponse({ description: 'Cuenta bloqueada' })
  configurar(
    @Body() dto: ConfigurarCuenta2faDto,
  ): Promise<RespuestaConfigurar2faDto> {
    return this.cuenta.configurar(dto);
  }

  @Post('activar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Activa la 2FA con el primer código; sube la versión de sesión y devuelve la sesión nueva con los códigos de respaldo',
  })
  @ApiOkResponse({ type: RespuestaActivacion2faDto })
  @ApiBadRequestResponse({ description: 'Código incorrecto (suma al bloqueo)' })
  @ApiConflictResponse({ description: 'La 2FA ya está activa' })
  @ApiTooManyRequestsResponse({ description: 'Cuenta bloqueada' })
  activar(
    @Body() dto: ActivarCuenta2faDto,
  ): Promise<RespuestaActivacion2faDto> {
    return this.cuenta.activar(dto);
  }

  @Post('desactivar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Desactiva la 2FA con clave + código; sube la versión de sesión y devuelve la sesión nueva',
  })
  @ApiOkResponse({ type: RespuestaSesionDto })
  @ApiBadRequestResponse({
    description: 'Clave o código incorrectos (suma al bloqueo)',
  })
  @ApiConflictResponse({ description: 'La 2FA no está activa' })
  @ApiTooManyRequestsResponse({ description: 'Cuenta bloqueada' })
  desactivar(
    @Body() dto: ReautenticarCuenta2faDto,
  ): Promise<RespuestaSesionDto> {
    return this.cuenta.desactivar(dto);
  }

  @Post('codigos-respaldo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Reemplaza los 10 códigos de respaldo (clave + código); se muestran una sola vez',
  })
  @ApiOkResponse({ type: RespuestaCodigosRespaldoDto })
  @ApiBadRequestResponse({
    description: 'Clave o código incorrectos (suma al bloqueo)',
  })
  @ApiConflictResponse({ description: 'La 2FA no está activa' })
  @ApiTooManyRequestsResponse({ description: 'Cuenta bloqueada' })
  regenerarCodigos(
    @Body() dto: ReautenticarCuenta2faDto,
  ): Promise<RespuestaCodigosRespaldoDto> {
    return this.cuenta.regenerarCodigos(dto);
  }
}
