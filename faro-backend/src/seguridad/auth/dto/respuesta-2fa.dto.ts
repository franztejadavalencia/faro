import { RespuestaSesionDto } from './respuesta-login.dto';

/** `POST /api/auth/2fa/configurar`: lo necesario para enrolar la app. */
export class RespuestaConfigurar2faDto {
  /** QR de la `uri` como PNG en data URL (`data:image/png;base64,…`). */
  qr!: string;

  /** `otpauth://totp/FARO:<usuario>?secret=…&issuer=FARO`. */
  uri!: string;

  /** El secreto en grupos de 4, para escribirlo a mano si no se puede escanear. */
  claveManual!: string;
}

/** Al activar la 2FA: la sesión y los códigos de respaldo, que se muestran una vez. */
export class RespuestaActivacion2faDto extends RespuestaSesionDto {
  /** 10 códigos `XXXXX-XXXXX` de un solo uso. No se vuelven a mostrar. */
  codigosRespaldo!: string[];
}
