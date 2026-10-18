import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { toDataURL } from 'qrcode';
import { DataSource, IsNull, Repository } from 'typeorm';
import { UsuarioCodigoRespaldo } from '../../entities/usuario-codigo-respaldo.entity';
import { Usuario } from '../../entities/usuario.entity';
import { claveCoincide, hashearClave } from '../../utils/clave';
import {
  generarCodigoRespaldo,
  normalizarCodigoRespaldo,
} from '../../utils/codigo-respaldo';
import { generarSecretoTotp, pasoDelCodigo, uriTotp } from '../../utils/totp';
import {
  CANTIDAD_CODIGOS_RESPALDO,
  EMISOR_TOTP,
  MENSAJE_2FA_ACTIVA,
} from '../constants/auth.constants';
import { RespuestaConfigurar2faDto } from '../dto/respuesta-2fa.dto';
import { CifradoTotpService } from './cifrado-totp.service';

/** Un TOTP son 6 dígitos; cualquier otra cosa se prueba como código de respaldo. */
export const CODIGO_TOTP = /^\d{6}$/;

export type ResultadoCodigo =
  | { valido: true; metodo: 'TOTP' | 'RESPALDO'; restantes?: number }
  | { valido: false; motivo: 'CODIGO_INCORRECTO' | 'CODIGO_REUSADO' };

/**
 * Lo que comparten el login con 2FA (B5, token temporal) y la 2FA con sesión del
 * dueño (B7): enrolar, activar, desactivar, antirreúso del TOTP y códigos de
 * respaldo de un solo uso. Todo con QueryBuilder y `usuario_modificacion` a mano:
 * en el login el contexto no tiene usuario (regla 2) y aquí el comportamiento es
 * el mismo en los dos caminos. TOTP con la hora real (decisión 61).
 */
@Injectable()
export class SegundoFactorService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    @InjectRepository(UsuarioCodigoRespaldo)
    private readonly codigos: Repository<UsuarioCodigoRespaldo>,
    private readonly dataSource: DataSource,
    private readonly cifrado: CifradoTotpService,
  ) {}

  /**
   * Genera el secreto, lo guarda **cifrado** como pendiente y entrega el QR.
   * Solo sin 2FA activa; repetirlo reemplaza el secreto pendiente. El secreto
   * nunca vuelve desde el cliente.
   */
  async iniciarEnrolamiento(
    usuario: Usuario,
  ): Promise<RespuestaConfigurar2faDto> {
    const idUsuario = usuario.idUsuario;
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

    const uri = uriTotp(EMISOR_TOTP, usuario.usuario, secreto);
    return {
      qr: await toDataURL(uri, { errorCorrectionLevel: 'M', margin: 1 }),
      uri,
      claveManual: secreto.match(/.{1,4}/g)?.join(' ') ?? secreto,
    };
  }

  /**
   * Primer código correcto: en una transacción activa la 2FA, guarda el paso,
   * **sube `version_sesion`** (decisión 87) y reemplaza los códigos de respaldo.
   * Exige que el secreto siga siendo el mismo contra el que se verificó el
   * código. Devuelve los códigos en claro y la versión nueva, o `null` si la 2FA
   * ya estaba activa o el secreto cambió.
   */
  async activar(
    usuario: Usuario,
    paso: number,
  ): Promise<{ codigos: string[]; version: number } | null> {
    const idUsuario = usuario.idUsuario;
    const { codigos, hashes } = await this.generarCodigos();

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
    return version === null ? null : { codigos, version };
  }

  /**
   * Apaga la 2FA: sin secreto ni códigos y con `version_sesion + 1` (decisión
   * 87). Devuelve la versión nueva, o `null` si ya estaba apagada.
   */
  async desactivar(idUsuario: number): Promise<number | null> {
    return this.dataSource.transaction(async (manager) => {
      const resultado = await manager
        .createQueryBuilder()
        .update(Usuario)
        .set({
          totpActivo: false,
          totpSecreto: null,
          totpUltimoPaso: null,
          versionSesion: () => 'version_sesion + 1',
          usuarioModificacion: idUsuario,
        })
        .where('id_usuario = :id', { id: idUsuario })
        .andWhere('totp_activo = true')
        .returning('version_sesion')
        .execute();
      const filas = resultado.raw as { version_sesion: number }[];
      if (filas.length === 0) return null;
      await manager.delete(UsuarioCodigoRespaldo, { idUsuario });
      return filas[0].version_sesion;
    });
  }

  /** Reemplaza los códigos de respaldo por 10 nuevos (los anteriores dejan de servir). */
  async regenerarCodigos(idUsuario: number): Promise<string[]> {
    const { codigos, hashes } = await this.generarCodigos();
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(UsuarioCodigoRespaldo, { idUsuario });
      await manager.insert(
        UsuarioCodigoRespaldo,
        hashes.map((hash) => ({ idUsuario, hash, usadoEn: null })),
      );
    });
    return codigos;
  }

  /** Cuántos códigos de respaldo sin usar le quedan. */
  contarCodigosRestantes(idUsuario: number): Promise<number> {
    return this.codigos.count({ where: { idUsuario, usadoEn: IsNull() } });
  }

  /**
   * Un código de la 2FA **ya activa**: TOTP (antirreúso) o de respaldo (un solo
   * uso). Lo usan la desactivación y la regeneración de códigos.
   */
  async comprobarCodigo(
    usuario: Usuario,
    entrada: string,
  ): Promise<ResultadoCodigo> {
    const codigo = entrada.trim();
    if (CODIGO_TOTP.test(codigo)) {
      if (!usuario.totpSecreto) {
        return { valido: false, motivo: 'CODIGO_INCORRECTO' };
      }
      const secreto = this.cifrado.descifrar(
        usuario.totpSecreto,
        usuario.idUsuario,
      );
      const paso = await pasoDelCodigo(secreto, codigo);
      if (paso === null) return { valido: false, motivo: 'CODIGO_INCORRECTO' };
      if (!(await this.aceptarPaso(usuario.idUsuario, paso))) {
        return { valido: false, motivo: 'CODIGO_REUSADO' };
      }
      return { valido: true, metodo: 'TOTP' };
    }
    const restantes = await this.usarCodigoRespaldo(usuario.idUsuario, codigo);
    if (restantes === null) {
      return { valido: false, motivo: 'CODIGO_INCORRECTO' };
    }
    return { valido: true, metodo: 'RESPALDO', restantes };
  }

  /**
   * Antirreúso (RFC 6238 §5.2): guarda el paso solo si es posterior al último
   * aceptado, en un `UPDATE` atómico; dos peticiones con el mismo código no
   * entran las dos.
   */
  async aceptarPaso(idUsuario: number, paso: number): Promise<boolean> {
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
  async usarCodigoRespaldo(
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

  private async generarCodigos(): Promise<{
    codigos: string[];
    hashes: string[];
  }> {
    const codigos = Array.from(
      { length: CANTIDAD_CODIGOS_RESPALDO },
      generarCodigoRespaldo,
    );
    const hashes = await Promise.all(
      codigos.map((c) => hashearClave(c.replace('-', ''))),
    );
    return { codigos, hashes };
  }
}
