import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { NegocioRepositoryFactory } from '@common/utils/negocio-repository.factory';
import { estaBloqueado } from '../../auth/services/intentos.service';
import { EVENTOS_BITACORA } from '../../constants/eventos-bitacora';
import { Persona } from '../../entities/persona.entity';
import { Usuario } from '../../entities/usuario.entity';
import { RolUsuario } from '../../permiso/entities/rol-usuario.entity';
import { PermisoService } from '../../permiso/services/permiso.service';
import { PersonaService } from '../../persona/services/persona.service';
import { BitacoraService } from '../../services/bitacora.service';
import { errorDeClave, hashearClave } from '../../utils/clave';
import { nombreCompleto } from '../../utils/nombre-completo';
import {
  ActualizarUsuarioDto,
  CrearUsuarioDto,
  FiltroUsuariosDto,
  RestablecerClaveDto,
  UsuarioDto,
} from '../dto/usuario.dto';
import { ActorNegocio } from '../types/actor-gestion';
import { paresFaltantes } from '../utils/jerarquia';
import { UsuarioClaveService } from './usuario-clave.service';

/** El mismo mensaje con el login tomado aquí o en otro negocio (decisión 105). */
const MENSAJE_LOGIN_NO_DISPONIBLE = 'Ese nombre de usuario no está disponible.';

/**
 * Usuarios (empleados) del negocio de la sesión (decisión 102). Todo se lee con
 * `NegocioRepository`: un usuario o una persona de otro negocio responde 404.
 * Las reglas de jerarquía (decisión 99 llevada a usuarios):
 * - nadie actúa sobre **su propia** fila por estas rutas (409);
 * - un usuario con rol **fijo** (Dueño) no se toca (409), y el rol fijo no se
 *   asigna a nadie: hay un solo Dueño por negocio;
 * - para actuar sobre un usuario, el editor **cubre** el rol actual de ese
 *   usuario, y para asignar un rol cubre el rol nuevo (403 con los pares que le
 *   faltan). Cubrir es tener todos los permisos, no más: ver `jerarquia.ts`.
 */
@Injectable()
export class UsuarioService {
  constructor(
    private readonly negocios: NegocioRepositoryFactory,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    private readonly dataSource: DataSource,
    private readonly permisos: PermisoService,
    private readonly personas: PersonaService,
    private readonly claves: UsuarioClaveService,
    private readonly bitacora: BitacoraService,
  ) {}

  async listar(filtro: FiltroUsuariosDto): Promise<UsuarioDto[]> {
    const estado = filtro.estado ?? 'ACTIVOS';
    const where: FindOptionsWhere<Usuario> =
      estado === 'TODOS' ? {} : { idEstado: estado === 'ACTIVOS' ? 1 : 0 };
    const usuarios = await this.negocios.para(Usuario).find({
      where,
      relations: { persona: true, rol: true },
      order: { persona: { nombre: 'ASC', paterno: 'ASC' }, idUsuario: 'ASC' },
    });
    return usuarios.map(aDto);
  }

  async obtener(id: number): Promise<UsuarioDto> {
    return aDto(await this.buscar(id));
  }

  /**
   * Alta en una transacción: la persona (existente o nueva) y el usuario, con
   * `debe_cambiar_clave = true` (decisión 48).
   */
  async crear(dto: CrearUsuarioDto, editor: ActorNegocio): Promise<UsuarioDto> {
    if ((dto.idPersona === undefined) === (dto.persona === undefined)) {
      throw new BadRequestException(
        'Indique una persona existente (idPersona) o los datos de una nueva (persona), no ambas ni ninguna.',
      );
    }
    const errorClave = errorDeClave(dto.claveTemporal);
    if (errorClave) throw new BadRequestException(errorClave);

    const rol = await this.rolAsignable(dto.idRolUsuario, editor);
    await this.exigirLoginLibre(dto.usuario);
    const clave = await hashearClave(dto.claveTemporal);

    const creado = await this.dataSource.transaction(async (manager) => {
      let idPersona: number;
      if (dto.idPersona !== undefined) {
        const persona = await this.negocios
          .para(Persona, manager)
          .requireActiveEntity({ idPersona: dto.idPersona }, 'la persona');
        const conUsuario = await this.negocios
          .para(Usuario, manager)
          .exists({ where: { idPersona: persona.idPersona, idEstado: 1 } });
        if (conUsuario) {
          throw new ConflictException('La persona ya tiene un usuario activo.');
        }
        idPersona = persona.idPersona;
      } else {
        idPersona = (await this.personas.crear(dto.persona!, manager))
          .idPersona;
      }
      return manager.getRepository(Usuario).save(
        manager.getRepository(Usuario).create({
          usuario: dto.usuario,
          clave,
          idPersona,
          idRolUsuario: rol.idRolUsuario,
          debeCambiarClave: true,
        }),
      );
    });

    await this.bitacora.registrar(EVENTOS_BITACORA.USUARIO_CREADO, {
      idUsuarioObjetivo: creado.idUsuario,
      idRolUsuario: rol.idRolUsuario,
      rol: rol.nombre,
      personaNueva: dto.persona !== undefined,
    });
    return this.obtener(creado.idUsuario);
  }

  /** Cambia el rol y/o los datos de contacto de la persona. Login y documento no cambian. */
  async actualizar(
    id: number,
    dto: ActualizarUsuarioDto,
    editor: ActorNegocio,
  ): Promise<UsuarioDto> {
    const objetivo = await this.objetivoGestionable(id, editor);

    const rolAnterior = objetivo.rol!;
    const cambiaRol =
      dto.idRolUsuario !== undefined &&
      dto.idRolUsuario !== objetivo.idRolUsuario;
    const rolNuevo = cambiaRol
      ? await this.rolAsignable(dto.idRolUsuario!, editor)
      : null;

    if (!rolNuevo && dto.persona === undefined) return aDto(objetivo);

    await this.dataSource.transaction(async (manager) => {
      if (rolNuevo) {
        await manager.getRepository(Usuario).update(
          { idUsuario: id },
          {
            idRolUsuario: rolNuevo.idRolUsuario,
            usuarioModificacion: editor.idUsuario,
          },
        );
      }
      if (dto.persona !== undefined) {
        await this.personas.actualizarContacto(
          objetivo.persona!,
          dto.persona,
          manager,
        );
      }
    });

    await this.bitacora.registrar(EVENTOS_BITACORA.USUARIO_ACTUALIZADO, {
      idUsuarioObjetivo: id,
      ...(rolNuevo && {
        rolAnterior: rolAnterior.nombre,
        rolNuevo: rolNuevo.nombre,
      }),
      contacto: dto.persona !== undefined,
    });
    return this.obtener(id);
  }

  /**
   * Baja lógica: el guard JWT lo deja fuera en la siguiente petición (decisión
   * 30). Libera el login y la persona para un alta nueva.
   */
  async desactivar(id: number, editor: ActorNegocio): Promise<void> {
    const objetivo = await this.objetivoGestionable(id, editor);
    await this.usuarios.update(
      { idUsuario: id },
      { idEstado: 0, usuarioModificacion: editor.idUsuario },
    );
    await this.bitacora.registrar(EVENTOS_BITACORA.USUARIO_DESACTIVADO, {
      idUsuarioObjetivo: id,
      rol: objetivo.rol!.nombre,
    });
  }

  async restablecerClave(
    id: number,
    dto: RestablecerClaveDto,
    editor: ActorNegocio,
  ): Promise<void> {
    const objetivo = await this.objetivoGestionable(id, editor);
    await this.claves.restablecer(objetivo, dto.claveTemporal, editor);
  }

  async desbloquear(id: number, editor: ActorNegocio): Promise<void> {
    const objetivo = await this.objetivoGestionable(id, editor);
    await this.claves.desbloquear(objetivo, editor);
  }

  /** El usuario del negocio con persona y rol (cualquier estado), o 404. */
  private async buscar(id: number): Promise<Usuario> {
    const usuario = await this.negocios.para(Usuario).findOne({
      where: { idUsuario: id },
      relations: { persona: true, rol: true },
    });
    if (!usuario) {
      throw new NotFoundException('No se encontró el usuario en este negocio.');
    }
    return usuario;
  }

  /**
   * El usuario **activo** sobre el que el editor puede actuar: 404 si no es del
   * negocio, 409 si es el propio o el Dueño, 403 si su rol tiene permisos que el
   * editor no tiene.
   */
  private async objetivoGestionable(
    id: number,
    editor: ActorNegocio,
  ): Promise<Usuario> {
    const objetivo = await this.buscar(id);
    if (objetivo.idEstado !== 1) {
      throw new NotFoundException('No se encontró el usuario en este negocio.');
    }
    if (objetivo.idUsuario === editor.idUsuario) {
      throw new ConflictException(
        'No puede hacer esto sobre su propio usuario: su clave se cambia en «Cambiar contraseña» y su rol no lo cambia usted.',
      );
    }
    if (objetivo.rol?.esFijo) {
      throw new ConflictException(
        `El usuario con el rol «${objetivo.rol.nombre}» no se modifica desde aquí.`,
      );
    }
    await this.exigirCobertura(
      editor,
      objetivo.idRolUsuario,
      'actuar sobre este usuario',
    );
    return objetivo;
  }

  /** Un rol activo del negocio, no fijo y cubierto por el editor, o el error que corresponda. */
  private async rolAsignable(
    idRolUsuario: number,
    editor: ActorNegocio,
  ): Promise<RolUsuario> {
    const rol = await this.negocios
      .para(RolUsuario)
      .requireActiveEntity({ idRolUsuario }, 'el rol');
    if (rol.esFijo) {
      throw new ConflictException(
        `El rol «${rol.nombre}» es fijo: no se asigna a otros usuarios.`,
      );
    }
    await this.exigirCobertura(editor, rol.idRolUsuario, 'asignar este rol');
    return rol;
  }

  /** 403 con los pares que le faltan si el rol del editor no cubre el rol dado. */
  private async exigirCobertura(
    editor: ActorNegocio,
    idRolRequerido: number,
    accion: string,
  ): Promise<void> {
    if (editor.idRolUsuario === idRolRequerido) return;
    const [delEditor, requeridos] = await Promise.all([
      this.permisos.permisosDelRol(editor.idRolUsuario),
      this.permisos.permisosDelRol(idRolRequerido),
    ]);
    const faltan = paresFaltantes(delEditor, requeridos);
    if (faltan.length > 0) {
      throw new ForbiddenException(
        `No puede ${accion}: su rol no tiene permisos que ese rol sí tiene (${faltan.join(', ')}).`,
      );
    }
  }

  /** El login es único en toda la plataforma (decisión 43); el mensaje no dice dónde. */
  private async exigirLoginLibre(login: string): Promise<void> {
    const tomado = await this.usuarios
      .createQueryBuilder('u')
      .where('lower(u.usuario) = lower(:login)', { login })
      .andWhere('u.idEstado = 1')
      .getExists();
    if (tomado) throw new ConflictException(MENSAJE_LOGIN_NO_DISPONIBLE);
  }
}

function aDto(usuario: Usuario): UsuarioDto {
  const persona = usuario.persona!;
  const rol = usuario.rol!;
  return {
    idUsuario: usuario.idUsuario,
    usuario: usuario.usuario,
    nombre: nombreCompleto(persona),
    activo: usuario.idEstado === 1,
    bloqueado: estaBloqueado(usuario),
    debeCambiarClave: usuario.debeCambiarClave,
    totpActivo: usuario.totpActivo,
    rol: {
      idRolUsuario: rol.idRolUsuario,
      nombre: rol.nombre,
      esFijo: rol.esFijo,
    },
    persona: {
      idPersona: persona.idPersona,
      nombre: persona.nombre,
      paterno: persona.paterno,
      materno: persona.materno,
      tipoDocumento: persona.tipoDocumento,
      documento: persona.documento,
      correo: persona.correo,
      telefono: persona.telefono,
    },
  };
}
