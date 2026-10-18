import { SetMetadata } from '@nestjs/common';

export const PERMITIDO_CON_CLAVE_TEMPORAL = 'permitidoConClaveTemporal';

/**
 * La ruta sirve aunque el usuario tenga `debe_cambiar_clave` (decisión 48). Solo
 * el cambio de clave: el resto responde 403 hasta que la cambie.
 */
export const PermitidoConClaveTemporal = () =>
  SetMetadata(PERMITIDO_CON_CLAVE_TEMPORAL, true);
