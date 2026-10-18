import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Persona } from '../entities/persona.entity';
import { Usuario } from '../entities/usuario.entity';
import { PersonaController } from '../persona/controllers/persona.controller';
import { PersonaService } from '../persona/services/persona.service';
import { SeguridadModule } from '../seguridad.module';
import { UsuarioController } from './controllers/usuario.controller';
import { UsuarioClaveService } from './services/usuario-clave.service';
import { UsuarioService } from './services/usuario.service';

/**
 * Usuarios (empleados) del negocio y las personas. Exporta lo que D4
 * (proveedores) y D14 (admin de plataforma) reusarán: `PersonaService` y
 * `UsuarioClaveService`.
 */
@Module({
  imports: [SeguridadModule, TypeOrmModule.forFeature([Usuario, Persona])],
  controllers: [UsuarioController, PersonaController],
  providers: [UsuarioService, UsuarioClaveService, PersonaService],
  exports: [PersonaService, UsuarioClaveService],
})
export class UsuarioModule {}
