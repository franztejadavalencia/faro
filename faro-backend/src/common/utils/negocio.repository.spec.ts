import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  Brackets,
  Column,
  DataSource,
  Entity,
  PrimaryGeneratedColumn,
  Repository,
} from 'typeorm';
import { BaseNegocioEntity } from '../entities/base-negocio.entity';
import { RequestContextService } from '../services/request-context.service';
import { NegocioRepository } from './negocio.repository';

@Entity('articulo_prueba')
class Articulo extends BaseNegocioEntity {
  @PrimaryGeneratedColumn({ name: 'id_articulo_prueba' })
  idArticulo!: number;

  @Column({ type: 'varchar' })
  nombre!: string;
}

function repositorioFalso() {
  const metodos = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findBy: jest.fn().mockResolvedValue([]),
    findOneBy: jest.fn().mockResolvedValue(null),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    count: jest.fn().mockResolvedValue(0),
    countBy: jest.fn().mockResolvedValue(0),
    exists: jest.fn().mockResolvedValue(false),
  };
  return {
    metodos,
    repositorio: metodos as unknown as Repository<Articulo>,
  };
}

function conContexto<T>(idNegocio: number | null | undefined, fn: () => T): T {
  return contexto.ejecutarConContexto({ idUsuario: 1, idNegocio }, fn);
}

const contexto = new RequestContextService();

describe('NegocioRepository (métodos de lectura)', () => {
  it.each([
    ['find', (r: NegocioRepository<Articulo>) => r.find()],
    ['findOne', (r: NegocioRepository<Articulo>) => r.findOne({})],
    ['findBy', (r: NegocioRepository<Articulo>) => r.findBy({ nombre: 'a' })],
    [
      'findOneBy',
      (r: NegocioRepository<Articulo>) => r.findOneBy({ nombre: 'a' }),
    ],
    ['findAndCount', (r: NegocioRepository<Articulo>) => r.findAndCount()],
    ['count', (r: NegocioRepository<Articulo>) => r.count()],
    ['countBy', (r: NegocioRepository<Articulo>) => r.countBy({ nombre: 'a' })],
    ['exists', (r: NegocioRepository<Articulo>) => r.exists()],
  ])('%s recibe idNegocio del contexto', async (nombre, llamar) => {
    const { metodos, repositorio } = repositorioFalso();
    const negocios = new NegocioRepository(repositorio, contexto);
    await conContexto(7, () => llamar(negocios));
    const mock = metodos[nombre as keyof typeof metodos];
    expect(mock).toHaveBeenCalledTimes(1);
    const argumento = mock.mock.calls[0][0];
    const where =
      argumento && 'where' in argumento ? argumento.where : argumento;
    expect(where).toMatchObject({ idNegocio: 7 });
  });

  it('el filtro del contexto pisa un idNegocio que traiga el where', async () => {
    const { metodos, repositorio } = repositorioFalso();
    const negocios = new NegocioRepository(repositorio, contexto);
    await conContexto(7, () =>
      negocios.find({ where: { idNegocio: 99, nombre: 'x' } }),
    );
    expect(metodos.find).toHaveBeenCalledWith({
      where: { idNegocio: 7, nombre: 'x' },
    });
  });

  it('con where en arreglo (OR) lo aplica a cada elemento', async () => {
    const { metodos, repositorio } = repositorioFalso();
    const negocios = new NegocioRepository(repositorio, contexto);
    await conContexto(7, () =>
      negocios.findBy([{ nombre: 'a' }, { nombre: 'b', idNegocio: 99 }]),
    );
    expect(metodos.findBy).toHaveBeenCalledWith([
      { nombre: 'a', idNegocio: 7 },
      { nombre: 'b', idNegocio: 7 },
    ]);
  });

  it('conserva el resto de las opciones (relations, order, take)', async () => {
    const { metodos, repositorio } = repositorioFalso();
    const negocios = new NegocioRepository(repositorio, contexto);
    await conContexto(7, () =>
      negocios.find({ order: { nombre: 'ASC' }, take: 5 }),
    );
    expect(metodos.find).toHaveBeenCalledWith({
      order: { nombre: 'ASC' },
      take: 5,
      where: { idNegocio: 7 },
    });
  });

  it('un where en arreglo vacío queda solo con el filtro', async () => {
    const { metodos, repositorio } = repositorioFalso();
    const negocios = new NegocioRepository(repositorio, contexto);
    await conContexto(7, () => negocios.findBy([]));
    expect(metodos.findBy).toHaveBeenCalledWith({ idNegocio: 7 });
  });

  describe('falla cerrado', () => {
    it.each([
      ['usuario de plataforma (idNegocio null)', null],
      ['sin sesión (idNegocio undefined)', undefined],
    ])('%s → 403 y no consulta', (_texto, idNegocio) => {
      const { metodos, repositorio } = repositorioFalso();
      const negocios = new NegocioRepository(repositorio, contexto);
      expect(() => conContexto(idNegocio, () => negocios.find())).toThrow(
        ForbiddenException,
      );
      expect(metodos.find).not.toHaveBeenCalled();
    });

    it('fuera de un contexto también', () => {
      const { repositorio } = repositorioFalso();
      const negocios = new NegocioRepository(repositorio, contexto);
      expect(() => negocios.count()).toThrow(ForbiddenException);
    });
  });

  describe('requireActiveEntity', () => {
    it('filtra por negocio y por id_estado = 1', async () => {
      const { metodos, repositorio } = repositorioFalso();
      const fila = { idArticulo: 3 } as Articulo;
      metodos.findOne.mockResolvedValue(fila);
      const negocios = new NegocioRepository(repositorio, contexto);
      const r = await conContexto(7, () =>
        negocios.requireActiveEntity({ idArticulo: 3 }, 'el artículo'),
      );
      expect(r).toBe(fila);
      expect(metodos.findOne).toHaveBeenCalledWith({
        where: { idArticulo: 3, idEstado: 1, idNegocio: 7 },
        relations: undefined,
      });
    });

    it('404 si no es del negocio (el filtro no lo encuentra)', async () => {
      const { repositorio } = repositorioFalso();
      const negocios = new NegocioRepository(repositorio, contexto);
      await expect(
        conContexto(7, () =>
          negocios.requireActiveEntity({ idArticulo: 3 }, 'el artículo'),
        ),
      ).rejects.toThrow(
        new NotFoundException('No se encontró el artículo en estado activo'),
      );
    });

    it('IfPresent: null/undefined → null sin consultar', async () => {
      const { metodos, repositorio } = repositorioFalso();
      const negocios = new NegocioRepository(repositorio, contexto);
      await expect(
        conContexto(7, () =>
          negocios.requireActiveEntityIfPresent(
            null,
            'idArticulo',
            'el artículo',
          ),
        ),
      ).resolves.toBeNull();
      expect(metodos.findOne).not.toHaveBeenCalled();
    });
  });
});

describe('NegocioRepository.createQueryBuilder (SQL real de TypeORM)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    // Sin conectar: solo se construye la metadata para generar el SQL.
    dataSource = new DataSource({ type: 'postgres', entities: [Articulo] });
    await (
      dataSource as unknown as { buildMetadatas(): Promise<void> }
    ).buildMetadatas();
  });

  const negocios = () =>
    new NegocioRepository(dataSource.getRepository(Articulo), contexto);

  it('trae el filtro de negocio y su parámetro', () => {
    const qb = conContexto(7, () => negocios().createQueryBuilder('a'));
    const [sql, parametros] = qb.getQueryAndParameters();
    expect(sql).toMatch(/WHERE "a"\."id_negocio" = \$1/);
    expect(parametros).toEqual([7]);
  });

  it('un where() del llamador no borra el filtro: se vuelve AND', () => {
    const qb = conContexto(7, () =>
      negocios().createQueryBuilder('a').where('a.nombre = :n', { n: 'x' }),
    );
    const [sql, parametros] = qb.getQueryAndParameters();
    expect(sql).toMatch(/"a"\."id_negocio" = \$1 AND .*nombre/);
    expect(parametros).toEqual([7, 'x']);
  });

  it('orWhere() lanza y explica que va dentro de Brackets', () => {
    expect(() =>
      conContexto(7, () =>
        negocios()
          .createQueryBuilder('a')
          .andWhere('a.nombre = 1')
          .orWhere('x'),
      ),
    ).toThrow(/Brackets/);
  });

  it('orWhereInIds() también lanza (usa orWhere por dentro)', () => {
    expect(() =>
      conContexto(7, () =>
        negocios().createQueryBuilder('a').orWhereInIds([1]),
      ),
    ).toThrow(/orWhere\(\) no se permite/);
  });

  it('con Brackets las condiciones OR quedan entre paréntesis y el filtro se mantiene', () => {
    const qb = conContexto(7, () =>
      negocios()
        .createQueryBuilder('a')
        .andWhere(
          new Brackets((q) =>
            q.where('a.nombre = :x', { x: 'a' }).orWhere('a.nombre = :y', {
              y: 'b',
            }),
          ),
        ),
    );
    const [sql, parametros] = qb.getQueryAndParameters();
    expect(sql).toMatch(
      /WHERE "a"\."id_negocio" = \$1 AND \("a"\."nombre" = \$2 OR "a"\."nombre" = \$3\)/,
    );
    expect(parametros).toEqual([7, 'a', 'b']);
  });

  it('sin idNegocio en el contexto lanza 403', () => {
    expect(() =>
      conContexto(null, () => negocios().createQueryBuilder('a')),
    ).toThrow(ForbiddenException);
  });
});
