import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MODULOS } from '../permiso/constants/modulos';
import { OPCIONES } from '../permiso/constants/opciones';
import { RequierePermiso } from '../permiso/decorators/requiere-permiso.decorator';
import {
  FiltroBitacoraDto,
  PaginaBitacoraDto,
} from '../dto/filtro-bitacora.dto';
import { BitacoraService } from '../services/bitacora.service';

/** Consulta de la bitácora **del negocio** (decisión 51); de solo lectura. */
@ApiTags('bitacora')
@ApiBearerAuth()
@Controller('bitacora')
export class BitacoraController {
  constructor(private readonly bitacora: BitacoraService) {}

  @Get()
  @RequierePermiso(MODULOS.BITACORA, OPCIONES.VER)
  @ApiOperation({
    summary:
      'Eventos del negocio, del más reciente al más antiguo, con filtros y paginación',
  })
  @ApiOkResponse({ type: PaginaBitacoraDto })
  @ApiBadRequestResponse({ description: 'Filtro inválido o `desde` > `hasta`' })
  consultar(@Query() filtro: FiltroBitacoraDto): Promise<PaginaBitacoraDto> {
    return this.bitacora.consultar(filtro);
  }

  @Get('eventos')
  @RequierePermiso(MODULOS.BITACORA, OPCIONES.VER)
  @ApiOperation({ summary: 'Eventos que existen, para poblar el filtro' })
  @ApiOkResponse({ type: [String] })
  eventos(): string[] {
    return this.bitacora.eventos();
  }
}
