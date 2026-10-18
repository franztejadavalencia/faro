import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { RequestContextService } from '@common/services/request-context.service';
import {
  EVENTOS_BITACORA,
  MAX_USUARIO_EN_BITACORA,
  MOTIVOS_LOGIN_FALLIDO,
} from '../../constants/eventos-bitacora';
import { Usuario } from '../../entities/usuario.entity';
import { ActorAcceso, BitacoraService } from '../../services/bitacora.service';
import { claveCoincide, errorDeClave, hashearClave } from '../../utils/clave';
import { nombreCompleto } from '../../utils/nombre-completo';
import {
  MENSAJE_CREDENCIALES_INVALIDAS,
  MENSAJE_SESION_INVALIDA,
} from '../constants/auth.constants';
import { CambiarClaveDto } from '../dto/cambiar-clave.dto';
import { LoginDto } from '../dto/login.dto';
import { RespuestaLogin, RespuestaSesionDto } from '../dto/respuesta-login.dto';
import { estaBloqueado, IntentosService } from './intentos.service';
import { TokenService } from './token.service';

/**
 * Login, cambio de clave y bloqueo temporal (decisiones 48, 51 y 53); con 2FA
 * pendiente, el login entrega solo el token temporal (decisión 50). Lee
 * `usuario` con un `Repository` normal: el login no tiene sesión ni negocio en
 * el contexto (busca por el login, único en la plataforma) y el cambio de clave
 * busca por el `idUsuario` del token.
 */
@Injectable()
export class AuthService {
  /**
   * Hash de una clave que nadie conoce, con el mismo costo que los reales: si el
   * usuario no existe se compara contra este, para que el tiempo de respuesta no
   * revele qué cuentas existen (OWASP Authentication Cheat Sheet).
   */
  private readonly hashFicticio: Promise<string> = hashearClave(
    randomBytes(32).toString('hex'),
  );

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    private readonly tokens: TokenService,
    private readonly bitacora: BitacoraService,
    private readonly contexto: RequestContextService,
    private readonly intentos: IntentosService,
  ) {}

  async login(dto: LoginDto): Promise<RespuestaLogin> {
    const usuario = await this.buscar((qb) =>
      qb
        .where('lower(u.usuario) = lower(:usuario)', {
          usuario: dto.usuario.trim(),
        })
        .andWhere('u.idEstado = 1'),
    );
    // Siempre se corre bcrypt, exista o no el usuario.
    const coincide = await claveCoincide(
      dto.clave,
      usuario?.clave ?? (await this.hashFicticio),
    );

    if (!usuario) {
      await this.bitacora.registrarAcceso(
        EVENTOS_BITACORA.LOGIN_FALLIDO,
        null,
        {
          motivo: MOTIVOS_LOGIN_FALLIDO.USUARIO_INEXISTENTE,
          usuario: dto.usuario.slice(0, MAX_USUARIO_EN_BITACORA),
        },
      );
      throw new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS);
    }

    const actor = this.actor(usuario);
    if (estaBloqueado(usuario)) {
      // Aunque la clave sea correcta; no suma ni alarga el bloqueo.
      await this.falloDeLogin(actor, MOTIVOS_LOGIN_FALLIDO.BLOQUEADO);
    }
    if (!coincide) {
      await this.intentos.sumarFallo(actor, EVENTOS_BITACORA.LOGIN_FALLIDO, {
        motivo: MOTIVOS_LOGIN_FALLIDO.CLAVE_INCORRECTA,
      });
      throw new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS);
    }
    if (
      usuario.negocio &&
      (usuario.negocio.estado !== 'ACTIVO' || usuario.negocio.idEstado !== 1)
    ) {
      // La clave era correcta: no suma intentos.
      await this.falloDeLogin(actor, MOTIVOS_LOGIN_FALLIDO.NEGOCIO_SUSPENDIDO);
    }

    const estado2fa = usuario.totpActivo
      ? 'VERIFICAR_2FA'
      : requiere2fa(usuario)
        ? 'CONFIGURAR_2FA'
        : null;
    if (estado2fa) {
      // Sin reiniciar el contador: si la clave correcta lo pusiera en 0, quien
      // la sepa probaría 4 códigos por login sin bloquearse nunca.
      await this.bitacora.registrarAcceso(
        EVENTOS_BITACORA.LOGIN_2FA_PENDIENTE,
        actor,
        { estado: estado2fa },
      );
      return {
        estado: estado2fa,
        tokenTemporal: this.tokens.firmarTemporal({
          idUsuario: usuario.idUsuario,
          versionSesion: usuario.versionSesion,
        }),
      };
    }

    await this.intentos.reiniciar(usuario);
    await this.bitacora.registrarAcceso(EVENTOS_BITACORA.LOGIN_OK, actor);
    return this.respuestaSesion(usuario);
  }

  /** El usuario sale del token (contexto), nunca de la ruta ni del body. */
  async cambiarClave(dto: CambiarClaveDto): Promise<RespuestaSesionDto> {
    const idUsuario = this.contexto.obtenerIdUsuario();
    const usuario =
      idUsuario === undefined
        ? null
        : await this.buscar((qb) =>
            qb.where('u.idUsuario = :idUsuario', { idUsuario }),
          );
    if (!usuario) throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);

    const error = errorDeClave(dto.claveNueva);
    if (error) throw new BadRequestException(error);

    const actor = this.actor(usuario);
    if (estaBloqueado(usuario)) {
      // Durante el bloqueo no se compara: si no, se seguiría adivinando por aquí.
      await this.bitacora.registrarAcceso(
        EVENTOS_BITACORA.CAMBIO_CLAVE_FALLIDO,
        actor,
        { motivo: MOTIVOS_LOGIN_FALLIDO.BLOQUEADO },
      );
      throw new HttpException(
        'Demasiados intentos fallidos. Intente de nuevo más tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // 400 y no 401: un 401 cerraría la sesión en el frontend (decisión 47).
    if (!(await claveCoincide(dto.claveActual, usuario.clave))) {
      await this.intentos.sumarFallo(
        actor,
        EVENTOS_BITACORA.CAMBIO_CLAVE_FALLIDO,
        {
          motivo: MOTIVOS_LOGIN_FALLIDO.CLAVE_INCORRECTA,
        },
      );
      throw new BadRequestException('La clave actual no es correcta.');
    }
    if (dto.claveNueva === dto.claveActual) {
      throw new BadRequestException(
        'La clave nueva debe ser distinta de la actual.',
      );
    }

    usuario.clave = await hashearClave(dto.claveNueva);
    usuario.debeCambiarClave = false;
    // Cierra las demás sesiones; el token de la respuesta lleva la versión nueva.
    usuario.versionSesion += 1;
    await this.usuarios.save(usuario);
    await this.bitacora.registrar(EVENTOS_BITACORA.CAMBIO_CLAVE);
    return this.respuestaSesion(usuario);
  }

  /** Usuario con su clave, persona y negocio. */
  private buscar(
    filtrar: (qb: SelectQueryBuilder<Usuario>) => SelectQueryBuilder<Usuario>,
  ): Promise<Usuario | null> {
    return filtrar(
      this.usuarios
        .createQueryBuilder('u')
        .addSelect('u.clave')
        .innerJoinAndSelect('u.persona', 'p')
        .leftJoinAndSelect('u.negocio', 'n'),
    ).getOne();
  }

  private actor(usuario: Usuario): ActorAcceso {
    return { idUsuario: usuario.idUsuario, idNegocio: usuario.idNegocio };
  }

  private async falloDeLogin(
    actor: ActorAcceso,
    motivo: string,
  ): Promise<never> {
    await this.bitacora.registrarAcceso(EVENTOS_BITACORA.LOGIN_FALLIDO, actor, {
      motivo,
    });
    throw new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS);
  }

  /** Sesión abierta (§11): la usa también la 2FA al pasar el segundo factor. */
  respuestaSesion(usuario: Usuario): RespuestaSesionDto {
    return {
      estado: 'OK',
      token: this.tokens.firmar({
        idUsuario: usuario.idUsuario,
        idNegocio: usuario.idNegocio,
        versionSesion: usuario.versionSesion,
      }),
      usuario: {
        id: usuario.idUsuario,
        nombre: usuario.persona ? nombreCompleto(usuario.persona) : '',
        debeCambiarClave: usuario.debeCambiarClave,
        negocio: usuario.negocio
          ? { id: usuario.negocio.idNegocio, nombre: usuario.negocio.nombre }
          : null,
        // Roles, menú y permisos llegan con B6.
        rol: null,
      },
      menu: [],
      permisos: [],
    };
  }
}

/**
 * 2FA obligatoria (decisión 50): el admin de plataforma (sin negocio). Para el
 * dueño es opcional; la activa él desde su sesión (B7).
 */
function requiere2fa(usuario: Usuario): boolean {
  return usuario.idNegocio === null;
}
