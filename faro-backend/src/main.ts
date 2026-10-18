import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { VariablesEntorno } from './config/env.validation';
import { configurarApp } from './configurar-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configurarApp(app);

  const config = app.get(ConfigService<VariablesEntorno, true>);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API de FARO en el puerto ${port}`, 'Bootstrap');
}
bootstrap();
