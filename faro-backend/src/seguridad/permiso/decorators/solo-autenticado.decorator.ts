import { SetMetadata } from '@nestjs/common';

export const SOLO_AUTENTICADO = 'soloAutenticado';

/**
 * La ruta no pide un permiso del catálogo, solo una sesión válida: acciones de
 * la propia cuenta (cambiar la clave, la 2FA, ver el propio menú). Toda ruta
 * sin `@Publico()`, `@SoloAutenticado()` ni `@RequierePermiso()` responde 403
 * (denegar por defecto, decisión 99).
 */
export const SoloAutenticado = () => SetMetadata(SOLO_AUTENTICADO, true);
