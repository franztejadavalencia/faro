import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BitacoraController } from './controllers/bitacora.controller';
import { Bitacora } from './entities/bitacora.entity';
import { Persona } from './entities/persona.entity';
import { UsuarioCodigoRespaldo } from './entities/usuario-codigo-respaldo.entity';
import { Usuario } from './entities/usuario.entity';
import { BitacoraService } from './services/bitacora.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Persona,
      Usuario,
      UsuarioCodigoRespaldo,
      Bitacora,
    ]),
  ],
  controllers: [BitacoraController],
  providers: [BitacoraService],
  exports: [TypeOrmModule, BitacoraService],
})
export class SeguridadModule {}
