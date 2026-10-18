import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../entities/usuario.entity';
import { SeguridadModule } from '../seguridad.module';
import { RolUsuarioController } from './controllers/rol-usuario.controller';
import { ModuloOpcionSistema } from './entities/modulo-opcion-sistema.entity';
import { ModuloSistema } from './entities/modulo-sistema.entity';
import { OpcionModuloSistema } from './entities/opcion-modulo-sistema.entity';
import { PermisoRolUsuario } from './entities/permiso-rol-usuario.entity';
import { RolUsuario } from './entities/rol-usuario.entity';
import { PermisoService } from './services/permiso.service';
import { RolUsuarioService } from './services/rol-usuario.service';

/**
 * Roles, permisos, menú y omisión de costos. Global: los módulos de dominio
 * (D1 a D14) usan `@RequierePermiso` y `@OmitirSinVerCostos` sin importarlo.
 * `PermisoGuard` se registra en `AuthModule`, justo después de `JwtAuthGuard`
 * (los `APP_GUARD` corren en el orden en que se declaran).
 */
@Global()
@Module({
  imports: [
    SeguridadModule,
    TypeOrmModule.forFeature([
      Usuario,
      RolUsuario,
      PermisoRolUsuario,
      ModuloSistema,
      OpcionModuloSistema,
      ModuloOpcionSistema,
    ]),
  ],
  controllers: [RolUsuarioController],
  providers: [PermisoService, RolUsuarioService],
  exports: [PermisoService],
})
export class PermisoModule {}
