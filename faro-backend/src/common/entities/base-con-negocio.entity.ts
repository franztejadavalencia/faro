import { BaseEntity } from './base.entity';

/**
 * Toda fila que pertenece a un negocio (o, en plataforma, a ninguno). **No
 * declara la columna**: TypeORM conserva la primera columna registrada de cada
 * propiedad, la de la clase padre, así que una subclase no puede redeclarar una
 * columna heredada (decisión 81). La columna la ponen las dos bases concretas:
 * `BaseNegocioEntity` (`NOT NULL`) y `BaseNegocioOpcionalEntity` (nullable).
 *
 * Es lo que miran `AuditoriaSubscriber` (`instanceof`) y `NegocioRepository`
 * (genérico).
 */
export abstract class BaseConNegocioEntity extends BaseEntity {
  declare idNegocio: number | null;
}
