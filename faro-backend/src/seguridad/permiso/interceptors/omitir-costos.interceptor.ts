import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Decimal } from 'decimal.js';
import { map, Observable } from 'rxjs';
import { RequestSesion } from '../../auth/types/request-sesion';
import { OPCIONES } from '../constants/opciones';
import {
  OMITIR_SIN_VER_COSTOS,
  OmisionDeCostos,
} from '../decorators/omitir-sin-ver-costos.decorator';
import { PermisoService } from '../services/permiso.service';

/** Copia de `valor` sin las claves de `campos`, a cualquier profundidad. */
export function omitirCampos(
  valor: unknown,
  campos: ReadonlySet<string>,
): unknown {
  if (Array.isArray(valor)) {
    return valor.map((elemento) => omitirCampos(elemento, campos));
  }
  if (
    valor === null ||
    typeof valor !== 'object' ||
    valor instanceof Date ||
    Decimal.isDecimal(valor)
  ) {
    return valor;
  }
  // Sin mutar la entidad ni el DTO: se arma un objeto nuevo.
  const copia: Record<string, unknown> = {};
  for (const [clave, interior] of Object.entries(valor)) {
    if (campos.has(clave)) continue;
    copia[clave] = omitirCampos(interior, campos);
  }
  return copia;
}

@Injectable()
export class OmitirCostosInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly permisos: PermisoService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const omision = this.reflector.getAllAndOverride<OmisionDeCostos>(
      OMITIR_SIN_VER_COSTOS,
      [context.getHandler(), context.getClass()],
    );
    if (!omision) return next.handle();

    const idRol = context.switchToHttp().getRequest<RequestSesion>()
      .rolActual?.idRolUsuario;
    // Falla cerrado: sin rol conocido, se omiten.
    const puedeVer =
      idRol !== undefined &&
      (await this.permisos.tiene(idRol, omision.modulo, OPCIONES.VER_COSTOS));
    if (puedeVer) return next.handle();

    const campos = new Set(omision.campos);
    return next.handle().pipe(map((cuerpo) => omitirCampos(cuerpo, campos)));
  }
}
