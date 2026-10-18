import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MODULOS } from '../../permiso/constants/modulos';
import { OPCIONES } from '../../permiso/constants/opciones';
import { RequierePermiso } from '../../permiso/decorators/requiere-permiso.decorator';
import { BuscarPersonaDto, PersonaBuscadaDto } from '../dto/persona.dto';
import { PersonaService } from '../services/persona.service';

/**
 * Búsqueda de personas del negocio para el formulario de usuario. Con el permiso
 * de crear usuarios; D4 (proveedores) agregará su propia ruta, con su permiso,
 * sobre el mismo servicio.
 */
@ApiTags('personas')
@ApiBearerAuth()
@Controller('personas')
export class PersonaController {
  constructor(private readonly personas: PersonaService) {}

  @Get()
  @RequierePermiso(MODULOS.USUARIOS, OPCIONES.CREAR)
  @ApiOperation({
    summary:
      'Busca personas activas del negocio por documento o nombre (máx. 20)',
  })
  @ApiOkResponse({ type: [PersonaBuscadaDto] })
  @ApiBadRequestResponse({
    description: 'Falta `q` o tiene menos de 2 caracteres',
  })
  buscar(@Query() filtro: BuscarPersonaDto): Promise<PersonaBuscadaDto[]> {
    return this.personas.buscar(filtro.q);
  }
}
