import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  origenesCors,
  swaggerHabilitado,
  valorTrustProxy,
  VariablesEntorno,
} from './config/env.validation';

/**
 * Configuración común de la app. La usan `main.ts` y los e2e, para que los
 * tests prueben la app tal como corre (prefijo `/api` incluido).
 */
export function configurarApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService<VariablesEntorno, true>);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: origenesCors(config.get('CORS_ORIGIN', { infer: true })),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Solo detrás de un proxy confiable se leen x-forwarded-for / x-real-ip (decisión 51).
  const trustProxy = valorTrustProxy(
    config.get('TRUST_PROXY', { infer: true }),
  );
  if (trustProxy !== null) {
    app.set('trust proxy', trustProxy);
  }

  if (
    swaggerHabilitado(
      config.get('NODE_ENV', { infer: true }),
      config.get('SWAGGER', { infer: true }),
    )
  ) {
    const documento = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('FARO API')
        .setDescription('API de FARO')
        .setVersion('0.0.1')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, documento);
  }
}
