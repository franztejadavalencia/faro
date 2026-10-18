import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Publico } from '@common/decorators/publico.decorator';
import { PermitidoConClaveTemporal } from '../decorators/permitido-con-clave-temporal.decorator';
import { CambiarClaveDto } from '../dto/cambiar-clave.dto';
import { LoginDto } from '../dto/login.dto';
import { RespuestaLoginDto } from '../dto/respuesta-login.dto';
import { AuthService } from '../services/auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Publico()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia sesión y devuelve el JWT' })
  @ApiOkResponse({ type: RespuestaLoginDto })
  @ApiBadRequestResponse({ description: 'Body con formato inválido' })
  @ApiUnauthorizedResponse({
    description:
      'Credenciales inválidas: usuario o clave incorrectos, cuenta bloqueada o negocio suspendido (mismo mensaje)',
  })
  login(@Body() dto: LoginDto): Promise<RespuestaLoginDto> {
    return this.authService.login(dto);
  }

  @Post('cambiar-clave')
  @PermitidoConClaveTemporal()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Cambia la clave del usuario de la sesión y cierra sus demás sesiones',
  })
  @ApiOkResponse({
    type: RespuestaLoginDto,
    description: 'Con un token nuevo: el anterior deja de servir',
  })
  @ApiBadRequestResponse({
    description: 'Clave actual incorrecta, o clave nueva inválida o igual',
  })
  @ApiUnauthorizedResponse({ description: 'Sin sesión válida' })
  @ApiTooManyRequestsResponse({
    description: 'Cuenta bloqueada temporalmente',
  })
  cambiarClave(@Body() dto: CambiarClaveDto): Promise<RespuestaLoginDto> {
    return this.authService.cambiarClave(dto);
  }
}
