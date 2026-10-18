import { getMetadataArgsStorage } from 'typeorm';
import { BaseConNegocioEntity } from './base-con-negocio.entity';
import { BaseNegocioOpcionalEntity } from './base-negocio-opcional.entity';
import { BaseNegocioEntity } from './base-negocio.entity';

type Clase = abstract new () => object;

const columnaIdNegocio = (clase: Clase) =>
  getMetadataArgsStorage().columns.filter(
    (c) => c.target === clase && c.propertyName === 'idNegocio',
  );

describe('bases con negocio (decisión 81)', () => {
  it('BaseNegocioEntity declara id_negocio NOT NULL', () => {
    const [columna] = columnaIdNegocio(BaseNegocioEntity);
    expect(columna.options.name).toBe('id_negocio');
    expect(columna.options.nullable).toBeFalsy();
  });

  it('BaseNegocioOpcionalEntity declara id_negocio nullable', () => {
    const [columna] = columnaIdNegocio(BaseNegocioOpcionalEntity);
    expect(columna.options.name).toBe('id_negocio');
    expect(columna.options.nullable).toBe(true);
  });

  it('la base común no declara la columna: ninguna subclase la redeclara', () => {
    expect(columnaIdNegocio(BaseConNegocioEntity)).toHaveLength(0);
  });

  it('las dos bases concretas son BaseConNegocioEntity', () => {
    expect(BaseNegocioEntity.prototype).toBeInstanceOf(BaseConNegocioEntity);
    expect(BaseNegocioOpcionalEntity.prototype).toBeInstanceOf(
      BaseConNegocioEntity,
    );
  });
});
