import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestContextService } from '../services/request-context.service';
import { RequestConUsuario } from '../types/payload-token';

@Injectable()
export class ContextoRequestInterceptor implements NestInterceptor {
  constructor(private readonly requestContext: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestConUsuario>();

    return this.requestContext.ejecutarConContexto(
      {
        idUsuario: request.usuarioActual?.idUsuario,
        idNegocio: request.usuarioActual?.idNegocio,
        ip: request.ip,
        userAgent: request.get('user-agent'),
        url: request.originalUrl,
        metodo: request.method,
      },
      () => next.handle(),
    );
  }
}
