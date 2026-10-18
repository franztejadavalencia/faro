import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MODULOS } from '../constants/modulos';
import { OPCIONES } from '../constants/opciones';
import { RequierePermiso } from '../decorators/requiere-permiso.decorator';
import { RolActual } from '../decorators/rol-actual.decorator';
import {
  ActualizarPermisosDto,
  ActualizarRolDto,
  CrearRolDto,
  MatrizRolDto,
  RolDto,
} from '../dto/rol-usuario.dto';
import { RolUsuarioService } from '../services/rol-usuario.service';

/**
 * Roles del negocio de la sesión y su matriz de permisos (decisiones 44, 45 y
 * 99). El Dueño es fijo: no se edita ni se borra.
 */
@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolUsuarioController {
  constructor(private readonly roles: RolUsuarioService) {}

  @Get()
  @RequierePermiso(MODULOS.ROLES, OPCIONES.VER)
  @ApiOperation({ summary: 'Roles activos del negocio' })
  @ApiOkResponse({ type: [RolDto] })
  listar(): Promise<RolDto[]> {
    return this.roles.listar();
  }

  @Post()
  @RequierePermiso(MODULOS.ROLES, OPCIONES.CREAR)
  @ApiOperation({
    summary:
      'Crea un rol sin permisos; se conceden con PUT /roles/:id/permisos',
  })
  @ApiConflictResponse({ description: 'Ya existe un rol con ese nombre' })
  crear(@Body() dto: CrearRolDto): Promise<RolDto> {
    return this.roles.crear(dto);
  }

  @Patch(':id')
  @RequierePermiso(MODULOS.ROLES, OPCIONES.EDITAR)
  @ApiOperation({ summary: 'Cambia el nombre o la descripción de un rol' })
  @ApiNotFoundResponse({ description: 'El rol no existe en este negocio' })
  @ApiConflictResponse({ description: 'Rol fijo, o nombre repetido' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarRolDto,
  ): Promise<RolDto> {
    return this.roles.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermiso(MODULOS.ROLES, OPCIONES.ELIMINAR)
  @ApiOperation({ summary: 'Baja lógica de un rol sin usuarios activos' })
  @ApiNotFoundResponse({ description: 'El rol no existe en este negocio' })
  @ApiConflictResponse({ description: 'Rol fijo, o con usuarios activos' })
  eliminar(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.roles.eliminar(id);
  }

  @Get(':id/permisos')
  @RequierePermiso(MODULOS.ROLES, OPCIONES.VER)
  @ApiOperation({
    summary: 'Matriz de permisos del rol: módulos × opciones que existen',
  })
  @ApiNotFoundResponse({ description: 'El rol no existe en este negocio' })
  matriz(@Param('id', ParseIntPipe) id: number): Promise<MatrizRolDto> {
    return this.roles.matriz(id);
  }

  @Put(':id/permisos')
  @RequierePermiso(MODULOS.ROLES, OPCIONES.EDITAR)
  @ApiOperation({
    summary:
      'Reemplaza los permisos activos del rol (solo puede cambiar los que su propio rol tiene)',
  })
  @ApiBadRequestResponse({ description: 'Un par módulo/opción no existe' })
  @ApiForbiddenResponse({
    description: 'Intenta cambiar permisos que su propio rol no tiene',
  })
  @ApiNotFoundResponse({ description: 'El rol no existe en este negocio' })
  @ApiConflictResponse({
    description: 'Rol fijo (Dueño) o el propio rol del editor',
  })
  actualizarPermisos(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPermisosDto,
    @RolActual() idRolEditor: number,
  ): Promise<MatrizRolDto> {
    return this.roles.actualizarPermisos(id, dto, idRolEditor);
  }
}
