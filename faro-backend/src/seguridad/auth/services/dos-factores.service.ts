import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EVENTOS_BITACORA,
  MOTIVOS_2FA_FALLIDO,
} from '../../constants/eventos-bitacora';
import { Usuario } from '../../entities/usuario.entity';
import { ActorAcceso, BitacoraService } from '../../services/bitacora.service';
import { pasoDelCodigo } from '../../utils/totp';
import {
  MENSAJE_2FA_ACTIVA,
  MENSAJE_CREDENCIALES_INVALIDAS,
  MENSAJE_SESION_INVALIDA,
} from '../constants/auth.constants';
import {
  RespuestaActivacion2faDto,
  RespuestaConfigurar2faDto,
} from '../dto/respuesta-2fa.dto';
import { RespuestaSesionDto } from '../dto/respuesta-login.dto';
import { AuthService } from './auth.service';
import { CifradoTotpService } from './cifrado-totp.service';
import { estaBloqueado, IntentosService } from './intentos.service';
import { CODIGO_TOTP, SegundoFactorService } from './segundo-factor.service';

/**
 * Configurar y verificar la 2FA del **login** (decisión 50), con el usuario del
 * token temporal. Todo ocurre **antes** de la sesión: la bitácora usa
 * `registrarAcceso` (decisión 88) y las escrituras llevan `usuario_modificacion`
 * a mano (el contexto no tiene usuario; regla 2). Lo que comparte con la 2FA con
 * sesión del dueño (B7) vive en `SegundoFactorService`. TOTP con la hora real
 * (decisión 61).
 */
@Injectable()
export class DosFactoresService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    private readonly auth: AuthService,
    private readonly intentos: IntentosService,
    private readonly cifrado: CifradoTotpService,
    private readonly bitacora: BitacoraService,
    private readonly segundo: SegundoFactorService,
  ) {}

  /**
   * Genera el secreto, lo guarda **cifrado** como pendiente y entrega el QR.
   * Solo sin 2FA activa; repetirlo reemplaza el secreto pendiente. El secreto
   * nunca vuelve desde el cliente.
   */
  async configurar(idUsuario: number): Promise<RespuestaConfigurar2faDto> {
    const usuario = await this.buscar(idUsuario);
    const actor = this.actor(usuario);
    if (estaBloqueado(usuario)) {
      await this.bitacora.registrarAcceso(
        EVENTOS_BITACORA.VERIFICACION_2FA_FALLIDA,
        actor,
        { motivo: MOTIVOS_2FA_FALLIDO.BLOQUEADO },
      );
      throw new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS);
    }
    if (usuario.totpActivo) throw new ConflictException(MENSAJE_2FA_ACTIVA);

    const respuesta = await this.segundo.iniciarEnrolamiento(usuario);
    await this.bitacora.registrarAcceso(EVENTOS_BITACORA.CONFIGURAR_2FA, actor);
    return respuesta;
  }

  /**
   * Segundo factor: código TOTP (±1 paso, sin reusar un paso) o de respaldo.
   * Con la 2FA pendiente, el primer TOTP correcto la activa y devuelve los
   * códigos de respaldo. Los fallos suman con los de la clave (decisión 53) y
   * responden siempre "Credenciales inválidas".
   */
  async verificar(
    idUsuario: number,
    codigo: string,
  ): Promise<RespuestaSesionDto | RespuestaActivacion2faDto> {
    const usuario = await this.buscar(idUsuario);
    const actor = this.actor(usuario);
    if (estaBloqueado(usuario)) {
      // Durante el bloqueo no se mira el código ni se suma (como el login).
      await this.bitacora.registrarAcceso(
        EVENTOS_BITACORA.VERIFICACION_2FA_FALLIDA,
        actor,
        { motivo: MOTIVOS_2FA_FALLIDO.BLOQUEADO },
      );
      throw new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS);
    }
    if (!usuario.totpSecreto) {
      return this.fallo(actor, MOTIVOS_2FA_FALLIDO.SIN_CONFIGURAR);
    }

    const entrada = codigo.trim();
    let detalle: Record<string, unknown>;
    if (CODIGO_TOTP.test(entrada)) {
      const secreto = this.cifrado.descifrar(usuario.totpSecreto, idUsuario);
      const paso = await pasoDelCodigo(secreto, entrada);
      if (paso === null) {
        return this.fallo(actor, MOTIVOS_2FA_FALLIDO.CODIGO_INCORRECTO);
      }
      if (!usuario.totpActivo) return this.activar(usuario, paso);
      if (!(await this.segundo.aceptarPaso(idUsuario, paso))) {
        return this.fallo(actor, MOTIVOS_2FA_FALLIDO.CODIGO_REUSADO);
      }
      detalle = { metodo: 'TOTP' };
    } else {
      const restantes = usuario.totpActivo
        ? await this.segundo.usarCodigoRespaldo(idUsuario, entrada)
        : null;
      if (restantes === null) {
        return this.fallo(actor, MOTIVOS_2FA_FALLIDO.CODIGO_INCORRECTO);
      }
      detalle = { metodo: 'RESPALDO', restantes };
    }

    await this.intentos.reiniciar(usuario);
    await this.bitacora.registrarAcceso(
      EVENTOS_BITACORA.LOGIN_OK,
      actor,
      detalle,
    );
    return await this.auth.respuestaSesion(usuario);
  }

  /**
   * Primer código correcto: activa la 2FA, sube `version_sesion` (el token
   * temporal usado deja de servir, decisión 87) y entrega los códigos de
   * respaldo (`SegundoFactorService.activar`).
   */
  private async activar(
    usuario: Usuario,
    paso: number,
  ): Promise<RespuestaActivacion2faDto> {
    const activada = await this.segundo.activar(usuario, paso);
    if (activada === null) throw new ConflictException(MENSAJE_2FA_ACTIVA);

    usuario.totpActivo = true;
    usuario.versionSesion = activada.version;
    await this.intentos.reiniciar(usuario);
    await this.bitacora.registrarAcceso(
      EVENTOS_BITACORA.ACTIVACION_2FA,
      this.actor(usuario),
    );
    return {
      ...(await this.auth.respuestaSesion(usuario)),
      codigosRespaldo: activada.codigos,
    };
  }

  /** Usuario con su secreto cifrado, persona y negocio (para la sesión). */
  private async buscar(idUsuario: number): Promise<Usuario> {
    const usuario = await this.usuarios
      .createQueryBuilder('u')
      .addSelect('u.totpSecreto')
      .innerJoinAndSelect('u.persona', 'p')
      .innerJoinAndSelect('u.rol', 'rol')
      .leftJoinAndSelect('u.negocio', 'n')
      .where('u.idUsuario = :idUsuario', { idUsuario })
      .getOne();
    // El guard ya validó el token contra esta fila; aquí solo por si se borró.
    if (!usuario) throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);
    return usuario;
  }

  private actor(usuario: Usuario): ActorAcceso {
    return { idUsuario: usuario.idUsuario, idNegocio: usuario.idNegocio };
  }

  private async fallo(actor: ActorAcceso, motivo: string): Promise<never> {
    await this.intentos.sumarFallo(
      actor,
      EVENTOS_BITACORA.VERIFICACION_2FA_FALLIDA,
      { motivo },
    );
    throw new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS);
  }
}
