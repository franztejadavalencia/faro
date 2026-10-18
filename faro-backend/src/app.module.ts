import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validarEntorno, VariablesEntorno } from './config/env.validation';
import { opcionesTypeOrm } from '@database/typeorm.config';
import { CommonModule } from './common/common.module';
import { SaludModule } from './salud/salud.module';
import { PlataformaModule } from '@plataforma/plataforma.module';
import { SeguridadModule } from '@seguridad/seguridad.module';
import { AuthModule } from '@seguridad/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV ?? 'development'}`,
      validate: validarEntorno,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<VariablesEntorno, true>) => ({
        ...opcionesTypeOrm({
          DB_HOST: config.get('DB_HOST', { infer: true }),
          DB_PORT: config.get('DB_PORT', { infer: true }),
          DB_NAME: config.get('DB_NAME', { infer: true }),
          DB_USER: config.get('DB_USER', { infer: true }),
          DB_PASSWORD: config.get('DB_PASSWORD', { infer: true }),
        }),
        autoLoadEntities: true,
      }),
    }),
    CommonModule,
    SaludModule,
    PlataformaModule,
    SeguridadModule,
    AuthModule,
  ],
})
export class AppModule {}
