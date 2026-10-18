import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { VariablesEntorno } from '../../config/env.validation';
import { SeguridadModule } from '../seguridad.module';
import { ALGORITMO_TOKEN, VIGENCIA_TOKEN } from './constants/auth.constants';
import { AuthController } from './controllers/auth.controller';
import { DosFactoresController } from './controllers/dos-factores.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './services/auth.service';
import { CifradoTotpService } from './services/cifrado-totp.service';
import { DosFactoresService } from './services/dos-factores.service';
import { IntentosService } from './services/intentos.service';
import { TokenService } from './services/token.service';

@Module({
  imports: [
    SeguridadModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<VariablesEntorno, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { expiresIn: VIGENCIA_TOKEN, algorithm: ALGORITMO_TOKEN },
        verifyOptions: { algorithms: [ALGORITMO_TOKEN] },
      }),
    }),
  ],
  controllers: [AuthController, DosFactoresController],
  providers: [
    AuthService,
    TokenService,
    IntentosService,
    CifradoTotpService,
    DosFactoresService,
    // Guard global; B6 registra `PermisoGuard` después de este.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [TokenService],
})
export class AuthModule {}
