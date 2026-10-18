import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestContextService } from '@common/services/request-context.service';
import {
  EVENTOS_BITACORA,
  MOTIVOS_2FA_FALLIDO,
} from '../../constants/eventos-bitacora';
import { Usuario } from '../../entities/usuario.entity';
import { ActorAcceso, BitacoraService } from '../../services/bitacora.service';
import { claveCoincide } from '../../utils/clave';
import { pasoDelCodigo } from '../../utils/totp';
import {
  MENSAJE_2FA_ACTIVA,
  MENSAJE_SESION_INVALIDA,
} from '../constants/auth.constants';
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
import { AuthService } from './auth.service';
import { CifradoTotpService } from './cifrado-totp.service';
import { estaBloqueado, IntentosService } from './intentos.service';
import { CODIGO_TOTP, SegundoFactorService } from './segundo-factor.service';

const MENSAJE_BLOQUEADA =
  'Demasiados intentos fallidos. Intente de nuevo más tarde.';
const MENSAJE_NO_ACTIVA = 'La autenticación en dos pasos no está activa.';
const MENSAJE_CLAVE_INCORRECTA = 'La clave no es correcta.';
const MENSAJE_REAUTENTICACION = 'La clave o el código no son correctos.';

/**
 * 2FA **con sesión** del dueño (decisión 97): ver el estado, configurar, activar,
 * desactivar y regenerar los códigos de respaldo. Solo el Dueño (rol fijo de un
 * negocio, decisión 50): el admin la tiene obligatoria y los empleados no la usan.
 *
 * Tocar la configuración del segundo factor pide reautenticar (OWASP MFA Cheat
 * Sheet): `configurar` la clave; `desactivar` y `regenerar`, clave y código. Un
 * fallo suma al bloqueo (decisión 53) y responde **400**, no 401: un 401
 * cerraría la sesión en el frontend por un error de tipeo (decisión 89). El
 * usuario sale siempre del contexto (el token), nunca del body ni de la ruta.
 */
@Injectable()
export class Cuenta2faService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    private readonly auth: AuthService,
    private readonly intentos: IntentosService,
    private readonly cifrado: CifradoTotpService,
    private readonly bitacora: BitacoraService,
    private readonly contexto: RequestContextService,
    private readonly segundo: SegundoFactorService,
  ) {}

  async estado(): Promise<EstadoCuenta2faDto> {
    const usuario = await this.cargarDueno();
    return {
      activo: usuario.totpActivo,
      codigosRespaldoRestantes: usuario.totpActivo
        ? await this.segundo.contarCodigosRestantes(usuario.idUsuario)
        : 0,
    };
  }

  /** Genera el secreto pendiente y el QR. Pide la clave actual; 409 si ya está activa. */
  async configurar(
    dto: ConfigurarCuenta2faDto,
  ): Promise<RespuestaConfigurar2faDto> {
    const usuario = await this.cargarDueno();
    this.exigirNoBloqueado(usuario);
    if (usuario.totpActivo) throw new ConflictException(MENSAJE_2FA_ACTIVA);
    await this.exigirClave(usuario, dto.clave);

    const respuesta = await this.segundo.iniciarEnrolamiento(usuario);
    await this.bitacora.registrar(EVENTOS_BITACORA.CONFIGURAR_2FA);
    return respuesta;
  }

  /**
   * El primer código correcto activa la 2FA: sube `version_sesion`, así que el
   * token actual muere y la respuesta trae el nuevo, más los códigos de respaldo
   * (una sola vez).
   */
  async activar(dto: ActivarCuenta2faDto): Promise<RespuestaActivacion2faDto> {
    const usuario = await this.cargarDueno();
    this.exigirNoBloqueado(usuario);
    if (usuario.totpActivo) throw new ConflictException(MENSAJE_2FA_ACTIVA);
    if (!usuario.totpSecreto) {
      throw new BadRequestException(
        'Primero configure la autenticación en dos pasos.',
      );
    }

    const codigo = dto.codigo.trim();
    const paso = CODIGO_TOTP.test(codigo)
      ? await pasoDelCodigo(
          this.cifrado.descifrar(usuario.totpSecreto, usuario.idUsuario),
          codigo,
        )
      : null;
    if (paso === null) {
      return this.fallo(
        usuario,
        MOTIVOS_2FA_FALLIDO.CODIGO_INCORRECTO,
        'El código no es correcto.',
      );
    }

    const activada = await this.segundo.activar(usuario, paso);
    if (activada === null) throw new ConflictException(MENSAJE_2FA_ACTIVA);
    usuario.totpActivo = true;
    usuario.versionSesion = activada.version;
    await this.intentos.reiniciar(usuario);
    await this.bitacora.registrar(EVENTOS_BITACORA.ACTIVACION_2FA);
    return {
      ...(await this.auth.respuestaSesion(usuario)),
      codigosRespaldo: activada.codigos,
    };
  }

  /** Apaga la 2FA con clave + código. Sube `version_sesion`: responde con el token nuevo. */
  async desactivar(dto: ReautenticarCuenta2faDto): Promise<RespuestaSesionDto> {
    const usuario = await this.cargarDueno();
    this.exigirNoBloqueado(usuario);
    if (!usuario.totpActivo) throw new ConflictException(MENSAJE_NO_ACTIVA);
    const metodo = await this.reautenticar(usuario, dto);

    const version = await this.segundo.desactivar(usuario.idUsuario);
    if (version === null) throw new ConflictException(MENSAJE_NO_ACTIVA);
    usuario.totpActivo = false;
    usuario.totpSecreto = null;
    usuario.versionSesion = version;
    await this.intentos.reiniciar(usuario);
    await this.bitacora.registrar(EVENTOS_BITACORA.DESACTIVACION_2FA, {
      metodo,
    });
    return this.auth.respuestaSesion(usuario);
  }

  /** Reemplaza los 10 códigos de respaldo (clave + código). No toca `version_sesion`. */
  async regenerarCodigos(
    dto: ReautenticarCuenta2faDto,
  ): Promise<RespuestaCodigosRespaldoDto> {
    const usuario = await this.cargarDueno();
    this.exigirNoBloqueado(usuario);
    if (!usuario.totpActivo) throw new ConflictException(MENSAJE_NO_ACTIVA);
    const metodo = await this.reautenticar(usuario, dto);

    const codigosRespaldo = await this.segundo.regenerarCodigos(
      usuario.idUsuario,
    );
    await this.intentos.reiniciar(usuario);
    await this.bitacora.registrar(
      EVENTOS_BITACORA.CODIGOS_RESPALDO_REGENERADOS,
      { metodo },
    );
    return { codigosRespaldo };
  }

  /**
   * Clave actual y un segundo factor válido, o 400 que suma al bloqueo. La clave
   * se prueba primero y, si falla, el código ni se mira (no se gasta un paso).
   * Devuelve el método con que se probó, para la bitácora.
   */
  private async reautenticar(
    usuario: Usuario,
    dto: ReautenticarCuenta2faDto,
  ): Promise<'TOTP' | 'RESPALDO'> {
    if (!(await claveCoincide(dto.clave, usuario.clave))) {
      return this.fallo(
        usuario,
        MOTIVOS_2FA_FALLIDO.CLAVE_INCORRECTA,
        MENSAJE_REAUTENTICACION,
      );
    }
    const resultado = await this.segundo.comprobarCodigo(usuario, dto.codigo);
    if (!resultado.valido) {
      return this.fallo(usuario, resultado.motivo, MENSAJE_REAUTENTICACION);
    }
    return resultado.metodo;
  }

  private async exigirClave(usuario: Usuario, clave: string): Promise<void> {
    if (!(await claveCoincide(clave, usuario.clave))) {
      await this.fallo(
        usuario,
        MOTIVOS_2FA_FALLIDO.CLAVE_INCORRECTA,
        MENSAJE_CLAVE_INCORRECTA,
      );
    }
  }

  /** Durante el bloqueo no se compara nada ni se suma (como el cambio de clave). */
  private exigirNoBloqueado(usuario: Usuario): void {
    if (!estaBloqueado(usuario)) return;
    throw new HttpException(MENSAJE_BLOQUEADA, HttpStatus.TOO_MANY_REQUESTS);
  }

  private async fallo(
    usuario: Usuario,
    motivo: string,
    mensaje: string,
  ): Promise<never> {
    await this.intentos.sumarFallo(
      this.actor(usuario),
      EVENTOS_BITACORA.VERIFICACION_2FA_FALLIDA,
      { motivo },
    );
    throw new BadRequestException(mensaje);
  }

  private actor(usuario: Usuario): ActorAcceso {
    return { idUsuario: usuario.idUsuario, idNegocio: usuario.idNegocio };
  }

  /**
   * El usuario de la sesión, con clave y secreto, si es el Dueño de su negocio
   * (rol fijo); si no, 403. El admin de plataforma tiene la 2FA obligatoria y no
   * la gestiona aquí; el empleado no la usa (decisión 50).
   */
  private async cargarDueno(): Promise<Usuario> {
    const idUsuario = this.contexto.obtenerIdUsuario();
    const usuario =
      idUsuario === undefined
        ? null
        : await this.usuarios
            .createQueryBuilder('u')
            .addSelect(['u.clave', 'u.totpSecreto'])
            .innerJoinAndSelect('u.persona', 'p')
            .innerJoinAndSelect('u.rol', 'rol')
            .leftJoinAndSelect('u.negocio', 'n')
            .where('u.idUsuario = :idUsuario', { idUsuario })
            .getOne();
    if (!usuario) throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);
    if (usuario.idNegocio === null) {
      throw new ForbiddenException(
        'La autenticación en dos pasos del administrador de plataforma es obligatoria y no se desactiva.',
      );
    }
    if (!usuario.rol?.esFijo) {
      throw new ForbiddenException(
        'Solo el dueño del negocio puede usar la autenticación en dos pasos.',
      );
    }
    return usuario;
  }
}
