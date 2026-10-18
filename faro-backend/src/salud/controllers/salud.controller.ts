import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { SaludDto } from '../dto/salud.dto';

// TODO(B4): marcar con @Publico() cuando exista el guard JWT global.
@ApiTags('salud')
@Controller('salud')
export class SaludController {
  private readonly logger = new Logger(SaludController.name);

  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Chequeo de salud de la API y de la base' })
  @ApiOkResponse({ type: SaludDto })
  @ApiServiceUnavailableResponse({
    description: 'La base de datos no responde',
  })
  async verificar(): Promise<SaludDto> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch (error) {
      // El detalle (host, mensaje de Postgres) solo va al log, nunca a la respuesta.
      this.logger.error(
        'La base de datos no responde',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException('La base de datos no responde');
    }
    return { estado: 'ok', baseDatos: 'ok' };
  }
}
