import { DataSource } from 'typeorm';
import { PermisoService } from './permiso.service';

const hoja = (
  codigo: string,
  orden: number,
  grupo: string | null,
  route = `/${codigo}`,
) => ({ codigo, nombre: codigo, route, icono: 'x', orden, grupo });

const grupo = (codigo: string, orden: number) => ({
  codigo,
  nombre: codigo,
  route: null,
  icono: 'g',
  orden,
  grupo: null,
});

/** `DataSource` falso: la 1.ª consulta trae las hojas con `ver`; la 2.ª, los grupos. */
function armar(
  hojas: ReturnType<typeof hoja>[],
  grupos = [
    grupo('g_ventas', 10),
    grupo('g_catalogo', 30),
    grupo('g_vacio', 5),
  ],
) {
  const query = jest
    .fn()
    .mockResolvedValueOnce(hojas)
    .mockResolvedValueOnce(grupos);
  return new PermisoService({ query } as unknown as DataSource);
}

describe('PermisoService.menuDelRol', () => {
  it('un rol sin ningún `ver` tiene el menú vacío', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const servicio = new PermisoService({ query } as unknown as DataSource);
    await expect(servicio.menuDelRol(1)).resolves.toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('agrupa las hojas bajo su grupo y ordena por `orden`', async () => {
    const menu = await armar([
      hoja('pos', 1, 'g_ventas'),
      hoja('ventas', 2, 'g_ventas'),
      hoja('productos', 2, 'g_catalogo'),
      hoja('gastos', 20, null),
    ]).menuDelRol(1);

    expect(menu.map((m) => m.codigo)).toEqual([
      'g_ventas',
      'gastos',
      'g_catalogo',
    ]);
    expect(menu[0].hijos?.map((h) => h.codigo)).toEqual(['pos', 'ventas']);
    expect(menu[0].route).toBeNull();
    // Una hoja de nivel superior no lleva `hijos`.
    expect(menu[1]).toEqual({
      codigo: 'gastos',
      nombre: 'gastos',
      route: '/gastos',
      icono: 'x',
    });
  });

  it('un grupo sin ningún módulo visible no aparece', async () => {
    const menu = await armar([hoja('pos', 1, 'g_ventas')]).menuDelRol(1);
    expect(menu.map((m) => m.codigo)).toEqual(['g_ventas']);
  });
});

describe('PermisoService.tiene', () => {
  it('es verdadero si la consulta devuelve una fila', async () => {
    const query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const servicio = new PermisoService({ query } as unknown as DataSource);
    await expect(servicio.tiene(3, 'pos', 'ver')).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(expect.any(String), [3, 'pos', 'ver']);
  });

  it('es falso si no hay fila', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const servicio = new PermisoService({ query } as unknown as DataSource);
    await expect(servicio.tiene(3, 'pos', 'ver')).resolves.toBe(false);
  });
});

describe('PermisoService.matrizDelRol', () => {
  it('agrupa las filas por módulo, conservando el orden', async () => {
    const query = jest.fn().mockResolvedValue([
      {
        modulo: 'lineas',
        modulo_nombre: 'Líneas',
        grupo: 'Catálogo',
        opcion: 'ver',
        opcion_nombre: 'Ver',
        activo: true,
      },
      {
        modulo: 'lineas',
        modulo_nombre: 'Líneas',
        grupo: 'Catálogo',
        opcion: 'crear',
        opcion_nombre: 'Crear',
        activo: false,
      },
      {
        modulo: 'gastos',
        modulo_nombre: 'Gastos',
        grupo: null,
        opcion: 'ver',
        opcion_nombre: 'Ver',
        activo: false,
      },
    ]);
    const servicio = new PermisoService({
      manager: { query },
    } as unknown as DataSource);
    await expect(servicio.matrizDelRol(1, 'NEGOCIO')).resolves.toEqual([
      {
        codigo: 'lineas',
        nombre: 'Líneas',
        grupo: 'Catálogo',
        opciones: [
          { codigo: 'ver', nombre: 'Ver', activo: true },
          { codigo: 'crear', nombre: 'Crear', activo: false },
        ],
      },
      {
        codigo: 'gastos',
        nombre: 'Gastos',
        grupo: null,
        opciones: [{ codigo: 'ver', nombre: 'Ver', activo: false }],
      },
    ]);
    expect(query).toHaveBeenCalledWith(expect.any(String), [1, 'NEGOCIO']);
  });
});
