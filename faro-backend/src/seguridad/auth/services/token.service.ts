import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PayloadToken } from '@common/types/payload-token';
import { ALGORITMO_TOKEN } from '../constants/auth.constants';

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

  /**
   * El payload de un token de **sesión** válido, o `null` si la firma, la
   * vigencia, el algoritmo o la forma no cumplen. Un token con `proposito` (el
   * temporal de la 2FA, B5) no es de sesión y se rechaza.
   */
  verificar(token: string): PayloadToken | null {
    let payload: Record<string, unknown>;
    try {
      payload = this.jwtService.verify<Record<string, unknown>>(token, {
        algorithms: [ALGORITMO_TOKEN],
      });
    } catch {
      return null;
    }
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
}
