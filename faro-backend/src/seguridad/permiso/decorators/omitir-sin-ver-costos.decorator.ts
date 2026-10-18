import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import { CodigoModulo } from '../constants/modulos';
import { OmitirCostosInterceptor } from '../interceptors/omitir-costos.interceptor';

export const OMITIR_SIN_VER_COSTOS = 'omitirSinVerCostos';

export interface OmisionDeCostos {
  modulo: CodigoModulo;
  /** Claves de la respuesta que son costo, margen o valor de inventario. */
  campos: readonly string[];
}

/**
 * Sin `ver_costos` en `modulo`, quita `campos` de la respuesta, en cualquier
 * nivel de objetos y arreglos (decisión 49). La lista la declara el controlador:
 * no se adivina por el nombre del campo. Ocultarlo solo en el frontend no basta.
 */
export const OmitirSinVerCostos = (
  modulo: CodigoModulo,
  campos: readonly string[],
) =>
  applyDecorators(
    SetMetadata(OMITIR_SIN_VER_COSTOS, {
      modulo,
      campos,
    } satisfies OmisionDeCostos),
    UseInterceptors(OmitirCostosInterceptor),
  );
