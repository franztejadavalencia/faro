import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PayloadToken } from '@common/types/payload-token';
import {
  ALGORITMO_TOKEN,
  PROPOSITO_2FA,
  VIGENCIA_TOKEN_TEMPORAL,
} from '../constants/auth.constants';

/**
 * Payload del token temporal de la 2FA (decisión 50): sin `idNegocio`, porque no
 * abre sesión. Lleva `versionSesion`: al activar la 2FA sube y el token deja de
 * servir.
 */
export interface PayloadTokenTemporal {
  idUsuario: number;
  versionSesion: number;
}

const esEntero = (valor: unknown): valor is number =>
  typeof valor === 'number' && Number.isInteger(valor);

/** Firma y verifica el JWT de sesión (de SIAP, con payload de FARO). */
@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  firmar(payload: PayloadToken): string {
    const { idUsuario, idNegocio, versionSesion } = payload;
    return this.jwtService.sign({ idUsuario, idNegocio, versionSesion });
  }

  /** JWT de 5 min con `proposito: '2fa'`, entre la clave y el segundo factor. */
  firmarTemporal(payload: PayloadTokenTemporal): string {
    const { idUsuario, versionSesion } = payload;
    return this.jwtService.sign(
      { idUsuario, versionSesion, proposito: PROPOSITO_2FA },
      { expiresIn: VIGENCIA_TOKEN_TEMPORAL },
    );
  }

  /**
   * El payload de un token **temporal** de la 2FA válido, o `null`. Un token de
   * sesión (sin `proposito`) o con otro propósito no sirve aquí.
   */
  verificarTemporal(token: string): PayloadTokenTemporal | null {
    const payload = this.decodificar(token);
    if (!payload || payload.proposito !== PROPOSITO_2FA) return null;
    const { idUsuario, versionSesion } = payload;
    if (!esEntero(idUsuario) || !esEntero(versionSesion)) return null;
    return { idUsuario, versionSesion };
  }

  /**
   * El payload de un token de **sesión** válido, o `null` si la firma, la
   * vigencia, el algoritmo o la forma no cumplen. Un token con `proposito` (el
   * temporal de la 2FA, B5) no es de sesión y se rechaza.
   */
  verificar(token: string): PayloadToken | null {
    const payload = this.decodificar(token);
    if (!payload) return null;
    const { idUsuario, idNegocio, versionSesion } = payload;
    if (
      'proposito' in payload ||
      !esEntero(idUsuario) ||
      !(idNegocio === null || esEntero(idNegocio)) ||
      !esEntero(versionSesion)
    ) {
      return null;
    }
    return { idUsuario, idNegocio, versionSesion };
  }

  /** Firma, vigencia y algoritmo; `null` si algo no cumple. */
  private decodificar(token: string): Record<string, unknown> | null {
    try {
      return this.jwtService.verify<Record<string, unknown>>(token, {
        algorithms: [ALGORITMO_TOKEN],
      });
    } catch {
      return null;
    }
  }
}
