import { Module } from '@nestjs/common';
import { SaludController } from './controllers/salud.controller';

@Module({
  controllers: [SaludController],
})
export class SaludModule {}
