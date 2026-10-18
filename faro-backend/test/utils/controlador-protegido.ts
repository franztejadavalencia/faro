import { Controller, Get, Module } from '@nestjs/common';
import { SoloAutenticado } from '../../src/seguridad/permiso/decorators/solo-autenticado.decorator';
import {
  ContextoRequest,
  RequestContextService,
} from '../../src/common/services/request-context.service';

/** Solo de prueba: una ruta protegida por el guard JWT global (sin `@Publico`). */
@SoloAutenticado()
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
