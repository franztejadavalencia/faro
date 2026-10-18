import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { NegocioRepositoryFactory } from '@common/utils/negocio-repository.factory';
import { EVENTOS_BITACORA } from '../../constants/eventos-bitacora';
import { Usuario } from '../../entities/usuario.entity';
import { BitacoraService } from '../../services/bitacora.service';
import {
  ActualizarPermisosDto,
  ActualizarRolDto,
  CrearRolDto,
  MatrizRolDto,
  RolDto,
} from '../dto/rol-usuario.dto';
import { PermisoRolUsuario } from '../entities/permiso-rol-usuario.entity';
import { RolUsuario } from '../entities/rol-usuario.entity';
import { PermisoService } from './permiso.service';

const clave = (modulo: string, opcion: string): string => `${modulo}.${opcion}`;

/**
 * Roles de **un negocio** y su matriz de permisos. Todo rol se busca con
 * `NegocioRepository`: uno de otro negocio (o el de plataforma) responde 404.
 * Los permisos cuelgan del rol, así que solo se tocan tras resolverlo aquí.
 */
@Injectable()
export class RolUsuarioService {
  constructor(
    private readonly negocios: NegocioRepositoryFactory,
    @InjectRepository(RolUsuario)
    private readonly roles: Repository<RolUsuario>,
    private readonly dataSource: DataSource,
    private readonly permisos: PermisoService,
    private readonly bitacora: BitacoraService,
  ) {}

  async listar(): Promise<RolDto[]> {
    const roles = await this.negocios.para(RolUsuario).find({
      where: { idEstado: 1 },
      order: { nombre: 'ASC' },
    });
    return roles.map(aDto);
  }

  async matriz(id: number): Promise<MatrizRolDto> {
    const rol = await this.buscar(id);
    return {
      rol: aDto(rol),
      modulos: await this.permisos.matrizDelRol(rol.idRolUsuario, 'NEGOCIO'),
    };
  }

  /** Nace sin permisos: se conceden con `actualizarPermisos` (anti-escalada). */
  async crear(dto: CrearRolDto): Promise<RolDto> {
    await this.rechazarNombreRepetido(dto.nombre);
    const rol = await this.roles.save(
      this.roles.create({
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        esFijo: false,
      }),
    );
    await this.bitacora.registrar(EVENTOS_BITACORA.ROL_CREADO, {
      idRolUsuario: rol.idRolUsuario,
      nombre: rol.nombre,
    });
    return aDto(rol);
  }

  async actualizar(id: number, dto: ActualizarRolDto): Promise<RolDto> {
    const rol = await this.buscarEditable(id);
    if (dto.nombre !== undefined && dto.nombre !== rol.nombre) {
      await this.rechazarNombreRepetido(dto.nombre, rol.idRolUsuario);
      rol.nombre = dto.nombre;
    }
    if (dto.descripcion !== undefined) rol.descripcion = dto.descripcion;
    const guardado = await this.roles.save(rol);
    await this.bitacora.registrar(EVENTOS_BITACORA.ROL_ACTUALIZADO, {
      idRolUsuario: guardado.idRolUsuario,
      nombre: guardado.nombre,
    });
    return aDto(guardado);
  }

  /** Baja lógica; no se borra un rol con usuarios activos. */
  async eliminar(id: number): Promise<void> {
    const rol = await this.buscarEditable(id);
    const usuarios = await this.negocios
      .para(Usuario)
      .countBy({ idRolUsuario: id, idEstado: 1 });
    if (usuarios > 0) {
      throw new ConflictException(
        `El rol «${rol.nombre}» tiene ${usuarios} usuario(s) activo(s): asígneles otro rol antes de eliminarlo.`,
      );
    }
    rol.idEstado = 0;
    await this.roles.save(rol);
    await this.bitacora.registrar(EVENTOS_BITACORA.ROL_ELIMINADO, {
      idRolUsuario: id,
      nombre: rol.nombre,
    });
  }

  /**
   * Reemplaza los permisos activos del rol. Reglas (decisión 99):
   * - el rol fijo (Dueño) y el **propio** rol del editor no se tocan (409);
   * - un par que no existe en el catálogo es 400;
   * - el editor solo puede **cambiar** (activar o desactivar) pares que su
   *   propio rol tiene activos: si no, 403 con la lista. Así un empleado con
   *   `roles.editar` no se da (ni da) lo que no tiene, ni quita lo que no administra.
   */
  async actualizarPermisos(
    id: number,
    dto: ActualizarPermisosDto,
    idRolEditor: number,
  ): Promise<MatrizRolDto> {
    const rol = await this.buscarEditable(id);
    if (rol.idRolUsuario === idRolEditor) {
      throw new ConflictException(
        'No puede modificar los permisos de su propio rol.',
      );
    }

    const validos = new Set(
      (await this.permisos.paresDeAmbito('NEGOCIO')).map((p) =>
        clave(p.modulo, p.opcion),
      ),
    );
    const deseados = new Set(
      dto.permisos.map((p) => clave(p.modulo, p.opcion)),
    );
    const inexistentes = [...deseados].filter((k) => !validos.has(k));
    if (inexistentes.length > 0) {
      throw new BadRequestException(
        `Permisos que no existen: ${inexistentes.join(', ')}.`,
      );
    }

    const cambios = await this.dataSource.transaction(async (manager) => {
      // Serializa dos ediciones del mismo rol.
      await manager.query(
        'SELECT 1 FROM rol_usuario WHERE id_rol_usuario = $1 FOR UPDATE',
        [rol.idRolUsuario],
      );
      const pares = await this.permisos.paresDeAmbito('NEGOCIO', manager);
      const idsPar = new Map(
        pares.map((p) => [clave(p.modulo, p.opcion), p] as const),
      );
      const repositorio = manager.getRepository(PermisoRolUsuario);
      const filas = await repositorio.find({
        where: { idRolUsuario: rol.idRolUsuario, idEstado: 1 },
      });
      const filaDe = new Map(
        filas.map((f) => {
          const par = pares.find(
            (p) =>
              p.idModuloSistema === f.idModuloSistema &&
              p.idOpcionModuloSistema === f.idOpcionModuloSistema,
          );
          return [par ? clave(par.modulo, par.opcion) : '', f] as const;
        }),
      );

      const activados: string[] = [];
      const desactivados: string[] = [];
      for (const k of validos) {
        const quiere = deseados.has(k);
        const fila = filaDe.get(k);
        if (quiere && !fila?.activo) activados.push(k);
        if (!quiere && fila?.activo) desactivados.push(k);
      }
      if (activados.length === 0 && desactivados.length === 0) {
        return { activados, desactivados };
      }

      const delEditor = new Set(
        (await this.permisos.permisosDelRol(idRolEditor)).map((p) =>
          clave(p.modulo, p.opcion),
        ),
      );
      const fuera = [...activados, ...desactivados].filter(
        (k) => !delEditor.has(k),
      );
      if (fuera.length > 0) {
        throw new ForbiddenException(
          `Solo puede cambiar permisos que su propio rol tiene. No los tiene: ${fuera.join(', ')}.`,
        );
      }

      const aGuardar = [
        ...activados.map((k) => {
          const par = idsPar.get(k);
          const existente = filaDe.get(k);
          return repositorio.create({
            ...existente,
            idRolUsuario: rol.idRolUsuario,
            idModuloSistema: par?.idModuloSistema,
            idOpcionModuloSistema: par?.idOpcionModuloSistema,
            activo: true,
          });
        }),
        ...desactivados.map((k) => {
          const existente = filaDe.get(k);
          return repositorio.create({ ...existente, activo: false });
        }),
      ];
      await repositorio.save(aGuardar);
      return { activados, desactivados };
    });

    if (cambios.activados.length > 0 || cambios.desactivados.length > 0) {
      // Solo el diff, no la matriz entera (decisión 93: bitácora sin ruido).
      await this.bitacora.registrar(EVENTOS_BITACORA.CAMBIO_PERMISOS, {
        idRolUsuario: rol.idRolUsuario,
        rol: rol.nombre,
        activados: cambios.activados,
        desactivados: cambios.desactivados,
      });
    }
    return this.matriz(rol.idRolUsuario);
  }

  /** El rol activo del negocio, o 404 (también si es de otro negocio). */
  private buscar(id: number): Promise<RolUsuario> {
    return this.negocios
      .para(RolUsuario)
      .requireActiveEntity({ idRolUsuario: id }, 'el rol');
  }

  /** Como `buscar`, pero el rol fijo responde 409: no se edita ni se borra. */
  private async buscarEditable(id: number): Promise<RolUsuario> {
    const rol = await this.buscar(id);
    if (rol.esFijo) {
      throw new ConflictException(
        `El rol «${rol.nombre}» es fijo: no se puede modificar ni eliminar.`,
      );
    }
    return rol;
  }

  private async rechazarNombreRepetido(
    nombre: string,
    exceptoId?: number,
  ): Promise<void> {
    const consulta = this.negocios
      .para(RolUsuario)
      .createQueryBuilder('r')
      .andWhere('lower(r.nombre) = lower(:nombre)', { nombre })
      .andWhere('r.idEstado = 1');
    if (exceptoId !== undefined) {
      consulta.andWhere('r.idRolUsuario <> :exceptoId', { exceptoId });
    }
    if (await consulta.getExists()) {
      throw new ConflictException('Ya existe un rol con ese nombre.');
    }
  }
}

function aDto(rol: RolUsuario): RolDto {
  return {
    idRolUsuario: rol.idRolUsuario,
    nombre: rol.nombre,
    descripcion: rol.descripcion,
    esFijo: rol.esFijo,
  };
}
