import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiForbiddenResponse } from '@nestjs/swagger';
import { CodigoModulo } from '../constants/modulos';
import { CodigoOpcion } from '../constants/opciones';

export const REQUIERE_PERMISO = 'requierePermiso';

export interface PermisoRequerido {
  modulo: CodigoModulo;
  opcion: CodigoOpcion;
}

/**
 * La ruta exige que el rol del usuario tenga activa esta opción en este módulo
 * (decisión 38). Lo valida `PermisoGuard` en el backend en cada request.
 */
export const RequierePermiso = (modulo: CodigoModulo, opcion: CodigoOpcion) =>
  applyDecorators(
    SetMetadata(REQUIERE_PERMISO, {
      modulo,
      opcion,
    } satisfies PermisoRequerido),
    ApiForbiddenResponse({ description: 'El rol no tiene el permiso' }),
  );
