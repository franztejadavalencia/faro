import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ExcepcionesFilter } from './filters/excepciones.filter';
import { ContextoRequestInterceptor } from './interceptors/contexto-request.interceptor';
import { Reloj } from './reloj/reloj';
import { RelojSistema } from './reloj/reloj-sistema';
import { RequestContextService } from './services/request-context.service';
import { AuditoriaSubscriber } from './subscribers/auditoria.subscriber';
import { NegocioRepositoryFactory } from './utils/negocio-repository.factory';

/**
 * Sin `imports: [AuthModule]` ni `APP_GUARD`: `common/` no importa de
 * `seguridad/`. El guard JWT se registra en `seguridad/` (B4).
 */
@Global()
@Module({
  providers: [
    RequestContextService,
    AuditoriaSubscriber,
    NegocioRepositoryFactory,
    // El reloj se elige por código: los tests y el seed lo sustituyen con
    // `overrideProvider(Reloj)`; no hay variable de entorno que lo fije.
    { provide: Reloj, useClass: RelojSistema },
    { provide: APP_INTERCEPTOR, useClass: ContextoRequestInterceptor },
    { provide: APP_FILTER, useClass: ExcepcionesFilter },
  ],
  exports: [RequestContextService, NegocioRepositoryFactory, Reloj],
})
export class CommonModule {}
