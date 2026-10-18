import { SetMetadata } from '@nestjs/common';

export const SOLO_TOKEN_TEMPORAL_2FA = 'soloTokenTemporal2fa';

/**
 * La ruta acepta **solo** el token temporal de la 2FA (`proposito: '2fa'`) y
 * rechaza uno de sesión; el resto de rutas hace lo contrario (decisión 50).
 * Solo `POST /api/auth/2fa/configurar` y `/verificar`.
 */
export const SoloTokenTemporal2fa = () =>
  SetMetadata(SOLO_TOKEN_TEMPORAL_2FA, true);
