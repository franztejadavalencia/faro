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
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MODULOS } from '../../permiso/constants/modulos';
import { OPCIONES } from '../../permiso/constants/opciones';
import { RequierePermiso } from '../../permiso/decorators/requiere-permiso.decorator';
import { ActorNegocio } from '../decorators/actor-negocio.decorator';
import {
  ActualizarUsuarioDto,
  CrearUsuarioDto,
  FiltroUsuariosDto,
  RestablecerClaveDto,
  UsuarioDto,
} from '../dto/usuario.dto';
import { UsuarioService } from '../services/usuario.service';
import { ActorNegocio as Actor } from '../types/actor-gestion';

const SIN_JERARQUIA =
  'El rol del usuario (o el que se asigna) tiene permisos que el suyo no tiene';
const FIJO_O_PROPIO =
  'Es su propio usuario, el Dueño, o el rol asignado es fijo';

/**
 * Usuarios (empleados) del negocio (decisión 102). Quien hace la petición sale
 * de la sesión (`@ActorNegocio`), nunca del body ni de la ruta.
 */
@ApiTags('usuarios')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuarioController {
  constructor(private readonly usuarios: UsuarioService) {}

  @Get()
  @RequierePermiso(MODULOS.USUARIOS, OPCIONES.VER)
  @ApiOperation({ summary: 'Usuarios del negocio (por defecto, los activos)' })
  @ApiOkResponse({ type: [UsuarioDto] })
  listar(@Query() filtro: FiltroUsuariosDto): Promise<UsuarioDto[]> {
    return this.usuarios.listar(filtro);
  }

  @Get(':id')
  @RequierePermiso(MODULOS.USUARIOS, OPCIONES.VER)
  @ApiOperation({ summary: 'Un usuario del negocio' })
  @ApiOkResponse({ type: UsuarioDto })
  @ApiNotFoundResponse({ description: 'No es de este negocio' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<UsuarioDto> {
    return this.usuarios.obtener(id);
  }

  @Post()
  @RequierePermiso(MODULOS.USUARIOS, OPCIONES.CREAR)
  @ApiOperation({
    summary:
      'Alta de un empleado con una persona existente o nueva y una clave temporal',
  })
  @ApiBadRequestResponse({
    description: 'Falta la persona, o la clave temporal es inválida',
  })
  @ApiForbiddenResponse({ description: SIN_JERARQUIA })
  @ApiNotFoundResponse({
    description: 'La persona o el rol no son de este negocio',
  })
  @ApiConflictResponse({
    description:
      'Login no disponible, persona con usuario o con ese documento, o rol fijo',
  })
  crear(
    @Body() dto: CrearUsuarioDto,
    @ActorNegocio() editor: Actor,
  ): Promise<UsuarioDto> {
    return this.usuarios.crear(dto, editor);
  }

  @Patch(':id')
  @RequierePermiso(MODULOS.USUARIOS, OPCIONES.EDITAR)
  @ApiOperation({
    summary: 'Cambia el rol o los datos de contacto de la persona',
  })
  @ApiForbiddenResponse({ description: SIN_JERARQUIA })
  @ApiNotFoundResponse({ description: 'No es de este negocio' })
  @ApiConflictResponse({ description: FIJO_O_PROPIO })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarUsuarioDto,
    @ActorNegocio() editor: Actor,
  ): Promise<UsuarioDto> {
    return this.usuarios.actualizar(id, dto, editor);
  }

  @Post(':id/restablecer-clave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermiso(MODULOS.USUARIOS, OPCIONES.EDITAR)
  @ApiOperation({
    summary:
      'Clave temporal nueva: debe cambiarla al entrar y sus sesiones abiertas se cierran',
  })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({
    description: 'La clave temporal no cumple la política',
  })
  @ApiForbiddenResponse({ description: SIN_JERARQUIA })
  @ApiNotFoundResponse({ description: 'No es de este negocio' })
  @ApiConflictResponse({ description: FIJO_O_PROPIO })
  restablecerClave(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RestablecerClaveDto,
    @ActorNegocio() editor: Actor,
  ): Promise<void> {
    return this.usuarios.restablecerClave(id, dto, editor);
  }

  @Post(':id/desbloquear')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermiso(MODULOS.USUARIOS, OPCIONES.EDITAR)
  @ApiOperation({
    summary: 'Levanta el bloqueo temporal por intentos fallidos',
  })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: SIN_JERARQUIA })
  @ApiNotFoundResponse({ description: 'No es de este negocio' })
  @ApiConflictResponse({ description: FIJO_O_PROPIO })
  desbloquear(
    @Param('id', ParseIntPipe) id: number,
    @ActorNegocio() editor: Actor,
  ): Promise<void> {
    return this.usuarios.desbloquear(id, editor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequierePermiso(MODULOS.USUARIOS, OPCIONES.ELIMINAR)
  @ApiOperation({
    summary: 'Baja lógica: deja de entrar y libera su login y su persona',
  })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: SIN_JERARQUIA })
  @ApiNotFoundResponse({ description: 'No es de este negocio' })
  @ApiConflictResponse({ description: FIJO_O_PROPIO })
  desactivar(
    @Param('id', ParseIntPipe) id: number,
    @ActorNegocio() editor: Actor,
  ): Promise<void> {
    return this.usuarios.desactivar(id, editor);
  }
}
