import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface ContextoRequest {
  idUsuario?: number;
  /** `null` = usuario de plataforma; `undefined` = sin sesión. */
  idNegocio?: number | null;
  ip?: string;
  url?: string;
  metodo?: string;
}

@Injectable()
export class RequestContextService {
  private readonly almacenamiento = new AsyncLocalStorage<ContextoRequest>();

  ejecutarConContexto<T>(contexto: ContextoRequest, callback: () => T): T {
    return this.almacenamiento.run(contexto, callback);
  }

  obtenerContexto(): ContextoRequest | undefined {
    return this.almacenamiento.getStore();
  }

  obtenerIdUsuario(): number | undefined {
    return this.almacenamiento.getStore()?.idUsuario;
  }

  /** `undefined` si no hay negocio en el contexto (plataforma o sin sesión). */
  obtenerIdNegocio(): number | undefined {
    return this.almacenamiento.getStore()?.idNegocio ?? undefined;
  }
}
