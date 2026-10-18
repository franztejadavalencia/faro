import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, In, Repository } from 'typeorm';
import { NegocioRepositoryFactory } from '@common/utils/negocio-repository.factory';
import { Persona } from '../../entities/persona.entity';
import { Usuario } from '../../entities/usuario.entity';
import { nombreCompleto } from '../../utils/nombre-completo';
import {
  ContactoPersonaDto,
  PersonaBuscadaDto,
  PersonaNuevaDto,
} from '../dto/persona.dto';

/** Tope de la búsqueda: una lista para elegir, no un volcado de las personas. */
export const MAX_PERSONAS_BUSCADAS = 20;

/** Escapa `\`, `%` y `_` para que el texto del usuario sea literal en un `ILIKE`. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Personas del negocio (decisión 43). Todo con `NegocioRepository`: la ficha de
 * un negocio no la ve otro. Lo usa `UsuarioService` y lo reusará D4
 * (proveedores) con su propia ruta y su propio permiso.
 */
@Injectable()
export class PersonaService {
  constructor(
    private readonly negocios: NegocioRepositoryFactory,
    @InjectRepository(Persona)
    private readonly personas: Repository<Persona>,
  ) {}

  /** Personas activas por documento o nombre, con la marca `tieneUsuario`. */
  async buscar(texto: string): Promise<PersonaBuscadaDto[]> {
    const patron = `%${escaparLike(texto.trim())}%`;
    const encontradas = await this.negocios
      .para(Persona)
      .createQueryBuilder('p')
      .andWhere('p.idEstado = 1')
      .andWhere(
        new Brackets((q) =>
          q
            .where(
              "concat_ws(' ', p.nombre, p.paterno, p.materno) ILIKE :patron",
            )
            .orWhere('p.documento ILIKE :patron'),
        ),
        { patron },
      )
      .orderBy('p.nombre', 'ASC')
      .addOrderBy('p.paterno', 'ASC')
      .addOrderBy('p.idPersona', 'ASC')
      .take(MAX_PERSONAS_BUSCADAS)
      .getMany();
    if (encontradas.length === 0) return [];

    const conUsuario = new Set(
      (
        await this.negocios.para(Usuario).find({
          where: {
            idPersona: In(encontradas.map((p) => p.idPersona)),
            idEstado: 1,
          },
          select: { idUsuario: true, idPersona: true },
        })
      ).map((u) => u.idPersona),
    );
    return encontradas.map((p) => ({
      idPersona: p.idPersona,
      nombre: nombreCompleto(p),
      tipoDocumento: p.tipoDocumento,
      documento: p.documento,
      correo: p.correo,
      telefono: p.telefono,
      tieneUsuario: conUsuario.has(p.idPersona),
    }));
  }

  /** Alta de una persona natural. Documento repetido en el negocio: 409. */
  async crear(dto: PersonaNuevaDto, manager?: EntityManager): Promise<Persona> {
    if ((dto.tipoDocumento === undefined) !== (dto.documento === undefined)) {
      throw new BadRequestException(
        'El tipo de documento y el documento van juntos.',
      );
    }
    if (dto.tipoDocumento !== undefined && dto.documento !== undefined) {
      const repetida = await this.negocios.para(Persona, manager).exists({
        where: {
          tipoDocumento: dto.tipoDocumento,
          documento: dto.documento,
          idEstado: 1,
        },
      });
      if (repetida) {
        throw new ConflictException(
          'Ya existe una persona con ese documento en el negocio.',
        );
      }
    }
    const repositorio = manager
      ? manager.getRepository(Persona)
      : this.personas;
    return repositorio.save(
      repositorio.create({
        tipo: 'NATURAL',
        nombre: dto.nombre,
        paterno: dto.paterno ?? null,
        materno: dto.materno ?? null,
        tipoDocumento: dto.tipoDocumento ?? null,
        documento: dto.documento ?? null,
        correo: dto.correo ?? null,
        telefono: dto.telefono ?? null,
      }),
    );
  }

  /** Cambia nombre y datos de contacto de una persona ya cargada con `NegocioRepository`. */
  async actualizarContacto(
    persona: Persona,
    dto: ContactoPersonaDto,
    manager?: EntityManager,
  ): Promise<Persona> {
    if (dto.nombre !== undefined && dto.nombre.trim() === '') {
      throw new BadRequestException('El nombre no puede quedar vacío.');
    }
    if (dto.nombre !== undefined) persona.nombre = dto.nombre;
    if (dto.paterno !== undefined) persona.paterno = dto.paterno || null;
    if (dto.materno !== undefined) persona.materno = dto.materno || null;
    if (dto.correo !== undefined) persona.correo = dto.correo || null;
    if (dto.telefono !== undefined) persona.telefono = dto.telefono || null;
    const repositorio = manager
      ? manager.getRepository(Persona)
      : this.personas;
    return repositorio.save(persona);
  }
}
