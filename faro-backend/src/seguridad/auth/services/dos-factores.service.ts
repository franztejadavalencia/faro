import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { toDataURL } from 'qrcode';
import { DataSource, IsNull, Repository } from 'typeorm';
import {
  EVENTOS_BITACORA,
  MOTIVOS_2FA_FALLIDO,
} from '../../constants/eventos-bitacora';
import { UsuarioCodigoRespaldo } from '../../entities/usuario-codigo-respaldo.entity';
import { Usuario } from '../../entities/usuario.entity';
import { ActorAcceso, BitacoraService } from '../../services/bitacora.service';
import { claveCoincide, hashearClave } from '../../utils/clave';
import {
  generarCodigoRespaldo,
  normalizarCodigoRespaldo,
} from '../../utils/codigo-respaldo';
import { generarSecretoTotp, pasoDelCodigo, uriTotp } from '../../utils/totp';
import {
  CANTIDAD_CODIGOS_RESPALDO,
  EMISOR_TOTP,
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

const MENSAJE_2FA_ACTIVA = 'La autenticación en dos pasos ya está activa.';

/** Un TOTP son 6 dígitos; cualquier otra cosa se prueba como código de respaldo. */
const CODIGO_TOTP = /^\d{6}$/;

/**
 * Configurar y verificar la 2FA (decisión 50), con el usuario del token
 * temporal. Todo ocurre **antes** de la sesión: la bitácora usa
 * `registrarAcceso` (decisión 88) y las escrituras son QueryBuilder con
 * `usuario_modificacion` a mano (el contexto no tiene usuario; regla 2).
 * TOTP con la hora real (decisión 61).
 */
@Injectable()
export class DosFactoresService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    @InjectRepository(UsuarioCodigoRespaldo)
    private readonly codigos: Repository<UsuarioCodigoRespaldo>,
    private readonly dataSource: DataSource,
    private readonly auth: AuthService,
    private readonly intentos: IntentosService,
    private readonly cifrado: CifradoTotpService,
    private readonly bitacora: BitacoraService,
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

    const secreto = generarSecretoTotp();
    const resultado = await this.usuarios
      .createQueryBuilder()
      .update(Usuario)
      .set({
        totpSecreto: this.cifrado.cifrar(secreto, idUsuario),
        totpUltimoPaso: null,
        usuarioModificacion: idUsuario,
      })
      .where('id_usuario = :id', { id: idUsuario })
      .andWhere('totp_activo = false')
      .returning('id_usuario')
      .execute();
    if ((resultado.raw as unknown[]).length === 0) {
      throw new ConflictException(MENSAJE_2FA_ACTIVA);
    }
    await this.bitacora.registrarAcceso(EVENTOS_BITACORA.CONFIGURAR_2FA, actor);

    const uri = uriTotp(EMISOR_TOTP, usuario.usuario, secreto);
    return {
      qr: await toDataURL(uri, { errorCorrectionLevel: 'M', margin: 1 }),
      uri,
      claveManual: secreto.match(/.{1,4}/g)?.join(' ') ?? secreto,
    };
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
      if (!(await this.aceptarPaso(idUsuario, paso))) {
        return this.fallo(actor, MOTIVOS_2FA_FALLIDO.CODIGO_REUSADO);
      }
      detalle = { metodo: 'TOTP' };
    } else {
      const restantes = usuario.totpActivo
        ? await this.usarCodigoRespaldo(idUsuario, entrada)
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
   * Primer código correcto: en una transacción activa la 2FA, guarda el paso,
   * **sube `version_sesion`** (el token temporal usado deja de servir, decisión
   * 87) y reemplaza los códigos de respaldo. Exige que el secreto siga siendo
   * el mismo contra el que se verificó el código.
   */
  private async activar(
    usuario: Usuario,
    paso: number,
  ): Promise<RespuestaActivacion2faDto> {
    const idUsuario = usuario.idUsuario;
    const codigos = Array.from(
      { length: CANTIDAD_CODIGOS_RESPALDO },
      generarCodigoRespaldo,
    );
    const hashes = await Promise.all(
      codigos.map((c) => hashearClave(c.replace('-', ''))),
    );

    const version = await this.dataSource.transaction(async (manager) => {
      const resultado = await manager
        .createQueryBuilder()
        .update(Usuario)
        .set({
          totpActivo: true,
          totpUltimoPaso: paso,
          versionSesion: () => 'version_sesion + 1',
          usuarioModificacion: idUsuario,
        })
        .where('id_usuario = :id', { id: idUsuario })
        .andWhere('totp_activo = false')
        .andWhere('totp_secreto = :secreto', { secreto: usuario.totpSecreto })
        .returning('version_sesion')
        .execute();
      const filas = resultado.raw as { version_sesion: number }[];
      if (filas.length === 0) return null;
      await manager.delete(UsuarioCodigoRespaldo, { idUsuario });
      await manager.insert(
        UsuarioCodigoRespaldo,
        hashes.map((hash) => ({ idUsuario, hash, usadoEn: null })),
      );
      return filas[0].version_sesion;
    });
    if (version === null) throw new ConflictException(MENSAJE_2FA_ACTIVA);

    usuario.totpActivo = true;
    usuario.versionSesion = version;
    await this.intentos.reiniciar(usuario);
    await this.bitacora.registrarAcceso(
      EVENTOS_BITACORA.ACTIVACION_2FA,
      this.actor(usuario),
    );
    return {
      ...(await this.auth.respuestaSesion(usuario)),
      codigosRespaldo: codigos,
    };
  }

  /**
   * Antirreúso (RFC 6238 §5.2): guarda el paso solo si es posterior al último
   * aceptado, en un `UPDATE` atómico; dos peticiones con el mismo código no
   * entran las dos.
   */
  private async aceptarPaso(idUsuario: number, paso: number): Promise<boolean> {
    const resultado = await this.usuarios
      .createQueryBuilder()
      .update(Usuario)
      .set({ totpUltimoPaso: paso, usuarioModificacion: idUsuario })
      .where('id_usuario = :id', { id: idUsuario })
      .andWhere('(totp_ultimo_paso IS NULL OR totp_ultimo_paso < :paso)', {
        paso,
      })
      .returning('id_usuario')
      .execute();
    return (resultado.raw as unknown[]).length > 0;
  }

  /**
   * Marca como usado el código de respaldo que coincide y devuelve cuántos
   * quedan, o `null`. Se compara solo con los no usados y se marca con un
   * `UPDATE … WHERE usado_en IS NULL`: un código sirve una sola vez aunque
   * lleguen dos peticiones a la vez.
   */
  private async usarCodigoRespaldo(
    idUsuario: number,
    entrada: string,
  ): Promise<number | null> {
    const codigo = normalizarCodigoRespaldo(entrada);
    if (!codigo) return null;
    const pendientes = await this.codigos.find({
      where: { idUsuario, usadoEn: IsNull() },
      select: { idUsuarioCodigoRespaldo: true, hash: true },
    });
    const coincide = await Promise.all(
      pendientes.map((p) => claveCoincide(codigo, p.hash)),
    );
    const usado = pendientes[coincide.indexOf(true)];
    if (!usado) return null;

    const resultado = await this.codigos
      .createQueryBuilder()
      .update(UsuarioCodigoRespaldo)
      .set({ usadoEn: () => 'now()' })
      .where('id_usuario_codigo_respaldo = :id', {
        id: usado.idUsuarioCodigoRespaldo,
      })
      .andWhere('usado_en IS NULL')
      .returning('id_usuario_codigo_respaldo')
      .execute();
    if ((resultado.raw as unknown[]).length === 0) return null;
    return pendientes.length - 1;
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
