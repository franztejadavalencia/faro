import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VariablesEntorno } from '../../../config/env.validation';
import { cifrarSecreto, descifrarSecreto } from '../../utils/cifrado-totp';

/**
 * Cifra y descifra `usuario.totp_secreto` con `TOTP_CLAVE_CIFRADO` (32 bytes,
 * validada al arrancar). La clave vive solo en el `.env`, nunca en la base.
 */
@Injectable()
export class CifradoTotpService {
  private readonly clave: Buffer;

  constructor(config: ConfigService<VariablesEntorno, true>) {
    const base64: string = config.get('TOTP_CLAVE_CIFRADO', { infer: true });
    this.clave = Buffer.from(base64, 'base64');
  }

  cifrar(secreto: string, idUsuario: number): string {
    return cifrarSecreto(secreto, this.clave, idUsuario);
  }

  descifrar(texto: string, idUsuario: number): string {
    return descifrarSecreto(texto, this.clave, idUsuario);
  }
}
