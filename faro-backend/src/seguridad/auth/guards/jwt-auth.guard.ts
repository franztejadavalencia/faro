import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { ES_PUBLICO } from '@common/decorators/publico.decorator';
import { Usuario } from '../../entities/usuario.entity';
import {
  MENSAJE_DEBE_CAMBIAR_CLAVE,
  MENSAJE_SESION_INVALIDA,
} from '../constants/auth.constants';
import { PERMITIDO_CON_CLAVE_TEMPORAL } from '../decorators/permitido-con-clave-temporal.decorator';
import { SOLO_TOKEN_TEMPORAL_2FA } from '../decorators/solo-token-temporal-2fa.decorator';
import { TokenService } from '../services/token.service';
import { RequestCon2fa } from '../types/request-2fa';

/**
 * Guard global (`APP_GUARD`). Además de firma y vigencia, revisa en **cada
 * request** el estado del usuario y de su negocio (decisión 30) y la versión de
 * sesión: un token emitido antes de un cambio de clave ya no sirve. En las rutas
 * `@SoloTokenTemporal2fa()` acepta solo el token temporal de la 2FA (B5).
 *
 * Lee `usuario` con un `Repository` normal, no con `NegocioRepository`: corre
 * antes del contexto (todavía no hay negocio) y busca por la PK que trae un
 * token firmado por el servidor.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Una ruta pública ni lee el token: uno vencido en la cabecera no rompe el
    // login ni /api/salud.
    if (this.tiene(context, ES_PUBLICO)) return true;

    const request = context.switchToHttp().getRequest<RequestCon2fa>();
    const token = this.extraerToken(request);
    if (!token) throw new UnauthorizedException('Token no proporcionado');

    // Las rutas de la 2FA aceptan solo el token temporal y el resto solo el de
    // sesión: uno no sirve donde va el otro (decisión 50).
    if (this.tiene(context, SOLO_TOKEN_TEMPORAL_2FA)) {
      const temporal = this.tokenService.verificarTemporal(token);
      if (!temporal) throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);
      const usuario = await this.usuarioVigente(temporal);
      // Sin `usuarioActual`: no hay sesión todavía. `debe_cambiar_clave` se
      // exige después, con el token de sesión (la 2FA va primero).
      request.usuario2fa = { idUsuario: usuario.idUsuario };
      return true;
    }

    const payload = this.tokenService.verificar(token);
    if (!payload) throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);
    const usuario = await this.usuarioVigente(payload);
    if (usuario.idNegocio !== payload.idNegocio) {
      throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);
    }

    if (
      usuario.debeCambiarClave &&
      !this.tiene(context, PERMITIDO_CON_CLAVE_TEMPORAL)
    ) {
      throw new ForbiddenException(MENSAJE_DEBE_CAMBIAR_CLAVE);
    }

    request.usuarioActual = payload;
    return true;
  }

  /**
   * La fila del usuario si sigue activo, con su negocio activo y la misma
   * versión de sesión que el token; si no, 401.
   */
  private async usuarioVigente(token: {
    idUsuario: number;
    versionSesion: number;
  }): Promise<Usuario> {
    const usuario = await this.usuarios.findOne({
      where: { idUsuario: token.idUsuario },
      relations: { negocio: true },
      select: {
        idUsuario: true,
        idNegocio: true,
        idEstado: true,
        debeCambiarClave: true,
        versionSesion: true,
        negocio: { idNegocio: true, estado: true, idEstado: true },
      },
    });
    const negocioActivo =
      !usuario?.negocio ||
      (usuario.negocio.estado === 'ACTIVO' && usuario.negocio.idEstado === 1);
    if (
      !usuario ||
      usuario.idEstado !== 1 ||
      usuario.versionSesion !== token.versionSesion ||
      !negocioActivo
    ) {
      throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);
    }
    return usuario;
  }

  private tiene(context: ExecutionContext, clave: string): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(clave, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }

  private extraerToken(request: Request): string | undefined {
    const [tipo, token] = request.headers.authorization?.split(' ') ?? [];
    return tipo === 'Bearer' && token ? token : undefined;
  }
}
