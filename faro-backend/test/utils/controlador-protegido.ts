import { Controller, Get, Module } from '@nestjs/common';
import {
  ContextoRequest,
  RequestContextService,
} from '../../src/common/services/request-context.service';

/** Solo de prueba: una ruta protegida por el guard JWT global (sin `@Publico`). */
@Controller('prueba-auth')
export class ControladorProtegido {
  constructor(private readonly contexto: RequestContextService) {}

  @Get('yo')
  yo(): ContextoRequest | undefined {
    return this.contexto.obtenerContexto();
  }
}

@Module({ controllers: [ControladorProtegido] })
export class ModuloProtegido {}
