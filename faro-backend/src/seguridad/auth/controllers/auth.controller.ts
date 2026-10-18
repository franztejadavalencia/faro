import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { Publico } from '@common/decorators/publico.decorator';
import { PermitidoConClaveTemporal } from '../decorators/permitido-con-clave-temporal.decorator';
import { CambiarClaveDto } from '../dto/cambiar-clave.dto';
import { LoginDto } from '../dto/login.dto';
import {
  RespuestaDosFactoresDto,
  RespuestaLogin,
  RespuestaSesionDto,
} from '../dto/respuesta-login.dto';
import { AuthService } from '../services/auth.service';

const SESION = getSchemaPath(RespuestaSesionDto);
const DOS_FACTORES = getSchemaPath(RespuestaDosFactoresDto);

@ApiTags('auth')
@ApiExtraModels(RespuestaSesionDto, RespuestaDosFactoresDto)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Publico()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Inicia sesión: devuelve el JWT o, con 2FA pendiente, un token temporal',
  })
  @ApiOkResponse({
    description:
      'Unión discriminada por `estado`: `OK` trae la sesión; `CONFIGURAR_2FA` y `VERIFICAR_2FA`, solo el token temporal para /api/auth/2fa/*',
    schema: {
      oneOf: [{ $ref: SESION }, { $ref: DOS_FACTORES }],
      discriminator: {
        propertyName: 'estado',
        mapping: {
          OK: SESION,
          CONFIGURAR_2FA: DOS_FACTORES,
          VERIFICAR_2FA: DOS_FACTORES,
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Body con formato inválido' })
  @ApiUnauthorizedResponse({
    description:
      'Credenciales inválidas: usuario o clave incorrectos, cuenta bloqueada o negocio suspendido (mismo mensaje)',
  })
  login(@Body() dto: LoginDto): Promise<RespuestaLogin> {
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
    type: RespuestaSesionDto,
    description: 'Con un token nuevo: el anterior deja de servir',
  })
  @ApiBadRequestResponse({
    description: 'Clave actual incorrecta, o clave nueva inválida o igual',
  })
  @ApiUnauthorizedResponse({ description: 'Sin sesión válida' })
  @ApiTooManyRequestsResponse({
    description: 'Cuenta bloqueada temporalmente',
  })
  cambiarClave(@Body() dto: CambiarClaveDto): Promise<RespuestaSesionDto> {
    return this.authService.cambiarClave(dto);
  }
}
