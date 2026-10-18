import { paresFaltantes } from './jerarquia';

const p = (modulo: string, opcion: string) => ({ modulo, opcion });

describe('paresFaltantes (cobertura de un rol, decisión 99)', () => {
  it('un editor que tiene todos los pares cubre el rol', () => {
    expect(
      paresFaltantes(
        [p('pos', 'ver'), p('pos', 'crear'), p('productos', 'ver')],
        [p('pos', 'ver'), p('productos', 'ver')],
      ),
    ).toEqual([]);
  });

  it('lista, ordenados, los pares que le faltan', () => {
    expect(
      paresFaltantes(
        [p('pos', 'ver')],
        [p('productos', 'ver_costos'), p('pos', 'ver'), p('gastos', 'anular')],
      ),
    ).toEqual(['gastos.anular', 'productos.ver_costos']);
  });

  it('cubrir es tener todos, no tener más: dos roles iguales se cubren', () => {
    const rol = [p('pos', 'ver'), p('ventas', 'anular')];
    expect(paresFaltantes(rol, rol)).toEqual([]);
  });

  it('un rol sin permisos lo cubre cualquiera', () => {
    expect(paresFaltantes([], [])).toEqual([]);
    expect(paresFaltantes([p('pos', 'ver')], [])).toEqual([]);
  });

  it('tener la opción en otro módulo no cubre', () => {
    expect(
      paresFaltantes(
        [p('ventas', 'ver_costos')],
        [p('productos', 'ver_costos')],
      ),
    ).toEqual(['productos.ver_costos']);
  });

  it('un editor sin permisos no cubre un rol con alguno', () => {
    expect(paresFaltantes([], [p('pos', 'ver')])).toEqual(['pos.ver']);
  });
});
