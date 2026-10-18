import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B6: permisos. Catálogo global (`modulo_sistema`, `opcion_modulo_sistema`,
 * `modulo_opcion_sistema`), `rol_usuario`, `permiso_rol_usuario` y
 * `usuario.id_rol_usuario` (decisiones 44, 45, 85 y 99).
 *
 * El catálogo de abajo es una **foto fija**: no importa de `src/` (una migración
 * no debe cambiar si el código cambia). `test/permisos.e2e-spec.ts` comprueba
 * que coincide con `constants/catalogo.ts`. Un módulo nuevo va en **otra**
 * migración que llama a `otorgarARolesFijos`.
 */
const CATALOGO = {
  opciones: [
    {
      codigo: 'ver',
      nombre: 'Ver',
      orden: 1,
    },
    {
      codigo: 'crear',
      nombre: 'Crear',
      orden: 2,
    },
    {
      codigo: 'editar',
      nombre: 'Editar',
      orden: 3,
    },
    {
      codigo: 'eliminar',
      nombre: 'Eliminar',
      orden: 4,
    },
    {
      codigo: 'anular',
      nombre: 'Anular',
      orden: 5,
    },
    {
      codigo: 'cerrar',
      nombre: 'Cerrar mes',
      orden: 6,
    },
    {
      codigo: 'reabrir',
      nombre: 'Reabrir mes',
      orden: 7,
    },
    {
      codigo: 'ver_costos',
      nombre: 'Ver costos',
      orden: 8,
    },
  ],
  grupos: [
    {
      codigo: 'g_ventas',
      nombre: 'Ventas',
      icono: 'point_of_sale',
      orden: 10,
      ambito: 'NEGOCIO',
    },
    {
      codigo: 'g_inventario',
      nombre: 'Inventario',
      icono: 'inventory_2',
      orden: 20,
      ambito: 'NEGOCIO',
    },
    {
      codigo: 'g_catalogo',
      nombre: 'Catálogo',
      icono: 'category',
      orden: 30,
      ambito: 'NEGOCIO',
    },
    {
      codigo: 'g_contabilidad',
      nombre: 'Contabilidad',
      icono: 'account_balance',
      orden: 50,
      ambito: 'NEGOCIO',
    },
    {
      codigo: 'g_analisis',
      nombre: 'Análisis',
      icono: 'insights',
      orden: 70,
      ambito: 'NEGOCIO',
    },
    {
      codigo: 'g_configuracion',
      nombre: 'Configuración',
      icono: 'settings',
      orden: 80,
      ambito: 'NEGOCIO',
    },
    {
      codigo: 'g_seguridad',
      nombre: 'Seguridad',
      icono: 'shield',
      orden: 90,
      ambito: 'NEGOCIO',
    },
    {
      codigo: 'g_plataforma',
      nombre: 'Plataforma',
      icono: 'domain',
      orden: 100,
      ambito: 'PLATAFORMA',
    },
  ],
  modulos: [
    {
      codigo: 'pos',
      nombre: 'Punto de venta',
      descripcion: 'Vender en caja y emitir el comprobante',
      route: '/pos',
      icono: 'point_of_sale',
      orden: 1,
      grupo: 'g_ventas',
      ambito: 'NEGOCIO',
      opciones: ['ver', 'crear'],
    },
    {
      codigo: 'ventas',
      nombre: 'Ventas',
      descripcion: 'Listado, registro manual y anulación de ventas',
      route: '/ventas',
      icono: 'receipt_long',
      orden: 2,
      grupo: 'g_ventas',
      ambito: 'NEGOCIO',
      opciones: ['ver', 'crear', 'anular', 'ver_costos'],
    },
    {
      codigo: 'compras',
      nombre: 'Compras',
      descripcion: 'Compras a proveedores y su anulación',
      route: '/compras',
      icono: 'shopping_cart',
      orden: 1,
      grupo: 'g_inventario',
      ambito: 'NEGOCIO',
      opciones: ['ver', 'crear', 'anular', 'ver_costos'],
    },
    {
      codigo: 'inventario',
      nombre: 'Stock y kardex',
      descripcion: 'Existencias valoradas y kardex por producto',
      route: '/inventario',
      icono: 'warehouse',
      orden: 2,
      grupo: 'g_inventario',
      ambito: 'NEGOCIO',
      opciones: ['ver', 'ver_costos'],
    },
    {
      codigo: 'ajustes_inventario',
      nombre: 'Ajustes de inventario',
      descripcion: 'Inventario inicial, mermas y conteos',
      route: '/ajustes-inventario',
      icono: 'tune',
      orden: 3,
      grupo: 'g_inventario',
      ambito: 'NEGOCIO',
      opciones: ['ver', 'crear', 'anular', 'ver_costos'],
    },
    {
      codigo: 'lineas',
      nombre: 'Líneas',
      descripcion: 'Categorías de productos',
      route: '/lineas',
      icono: 'label',
      orden: 1,
      grupo: 'g_catalogo',
      ambito: 'NEGOCIO',
      opciones: ['ver', 'crear', 'editar', 'eliminar'],
    },
    {
      codigo: 'productos',
      nombre: 'Productos',
      descripcion: 'Catálogo de productos',
      route: '/productos',
      icono: 'package_2',
      orden: 2,
      grupo: 'g_catalogo',
      ambito: 'NEGOCIO',
      opciones: ['ver', 'crear', 'editar', 'eliminar', 'ver_costos'],
    },
    {
      codigo: 'proveedores',
      nombre: 'Proveedores',
      descripcion: 'Proveedores del negocio',
      route: '/proveedores',
      icono: 'local_shipping',
      orden: 3,
      grupo: 'g_catalogo',
      ambito: 'NEGOCIO',
      opciones: ['ver', 'crear', 'editar', 'eliminar'],
    },
    {
      codigo: 'gastos',
      nombre: 'Gastos',
      descripcion: 'Gastos indirectos del mes',
      route: '/gastos',
      icono: 'payments',
      orden: 40,
      grupo: null,
      ambito: 'NEGOCIO',
      opciones: ['ver', 'crear', 'anular'],
    },
    {
      codigo: 'plan_cuentas',
      nombre: 'Plan de cuentas',
      descripcion: 'Cuentas contables del negocio',
      route: '/contabilidad/plan-cuentas',
      icono: 'list_alt',
      orden: 1,
      grupo: 'g_contabilidad',
      ambito: 'NEGOCIO',
      opciones: ['ver'],
    },
    {
      codigo: 'libro_diario',
      nombre: 'Libro diario',
      descripcion: 'Asientos del mes',
      route: '/contabilidad/diario',
      icono: 'menu_book',
      orden: 2,
      grupo: 'g_contabilidad',
      ambito: 'NEGOCIO',
      opciones: ['ver'],
    },
    {
      codigo: 'libro_mayor',
      nombre: 'Libro mayor',
      descripcion: 'Movimientos por cuenta y por producto',
      route: '/contabilidad/mayor',
      icono: 'book',
      orden: 3,
      grupo: 'g_contabilidad',
      ambito: 'NEGOCIO',
      opciones: ['ver'],
    },
    {
      codigo: 'cuadre',
      nombre: 'Cuadre contable',
      descripcion: 'Control de cuadre entre auxiliares y cuentas',
      route: '/contabilidad/cuadre',
      icono: 'balance',
      orden: 4,
      grupo: 'g_contabilidad',
      ambito: 'NEGOCIO',
      opciones: ['ver'],
    },
    {
      codigo: 'cierre_mensual',
      nombre: 'Cierre mensual',
      descripcion: 'Cierre y reapertura de meses',
      route: '/cierre',
      icono: 'event_available',
      orden: 60,
      grupo: null,
      ambito: 'NEGOCIO',
      opciones: ['ver', 'cerrar', 'reabrir'],
    },
    {
      codigo: 'estado_resultados',
      nombre: 'Estado de resultados',
      descripcion: 'Resultado del mes por producto y línea',
      route: '/analisis/estado-resultados',
      icono: 'query_stats',
      orden: 1,
      grupo: 'g_analisis',
      ambito: 'NEGOCIO',
      opciones: ['ver', 'ver_costos'],
    },
    {
      codigo: 'ranking',
      nombre: 'Ranking',
      descripcion: 'Productos y líneas que más ganan y pierden',
      route: '/analisis/ranking',
      icono: 'leaderboard',
      orden: 2,
      grupo: 'g_analisis',
      ambito: 'NEGOCIO',
      opciones: ['ver', 'ver_costos'],
    },
    {
      codigo: 'dashboard',
      nombre: 'Dashboard',
      descripcion: 'Evolución mensual de ventas y utilidad',
      route: '/dashboard',
      icono: 'dashboard',
      orden: 3,
      grupo: 'g_analisis',
      ambito: 'NEGOCIO',
      opciones: ['ver', 'ver_costos'],
    },
    {
      codigo: 'negocio',
      nombre: 'Datos del negocio',
      descripcion: 'Régimen tributario y criterio de prorrateo',
      route: '/configuracion/negocio',
      icono: 'store',
      orden: 1,
      grupo: 'g_configuracion',
      ambito: 'NEGOCIO',
      opciones: ['ver', 'editar'],
    },
    {
      codigo: 'categorias_gasto',
      nombre: 'Categorías de gasto',
      descripcion: 'Categorías de gasto indirecto',
      route: '/configuracion/categorias-gasto',
      icono: 'sell',
      orden: 2,
      grupo: 'g_configuracion',
      ambito: 'NEGOCIO',
      opciones: ['ver', 'crear', 'editar', 'eliminar'],
    },
    {
      codigo: 'usuarios',
      nombre: 'Usuarios',
      descripcion: 'Empleados del negocio',
      route: '/seguridad/usuarios',
      icono: 'group',
      orden: 1,
      grupo: 'g_seguridad',
      ambito: 'NEGOCIO',
      opciones: ['ver', 'crear', 'editar', 'eliminar'],
    },
    {
      codigo: 'roles',
      nombre: 'Roles y permisos',
      descripcion: 'Roles del negocio y su matriz de permisos',
      route: '/seguridad/roles',
      icono: 'admin_panel_settings',
      orden: 2,
      grupo: 'g_seguridad',
      ambito: 'NEGOCIO',
      opciones: ['ver', 'crear', 'editar', 'eliminar'],
    },
    {
      codigo: 'bitacora',
      nombre: 'Bitácora',
      descripcion: 'Acciones sensibles del negocio',
      route: '/seguridad/bitacora',
      icono: 'history',
      orden: 3,
      grupo: 'g_seguridad',
      ambito: 'NEGOCIO',
      opciones: ['ver'],
    },
    {
      codigo: 'negocios',
      nombre: 'Negocios',
      descripcion: 'Negocios registrados en la plataforma',
      route: '/plataforma/negocios',
      icono: 'storefront',
      orden: 1,
      grupo: 'g_plataforma',
      ambito: 'PLATAFORMA',
      opciones: ['ver', 'editar'],
    },
    {
      codigo: 'bitacora_plataforma',
      nombre: 'Bitácora de plataforma',
      descripcion: 'Eventos de seguridad de la plataforma',
      route: '/plataforma/bitacora',
      icono: 'history',
      orden: 2,
      grupo: 'g_plataforma',
      ambito: 'PLATAFORMA',
      opciones: ['ver'],
    },
  ],
} as {
  opciones: { codigo: string; nombre: string; orden: number }[];
  grupos: {
    codigo: string;
    nombre: string;
    icono: string;
    orden: number;
    ambito: string;
  }[];
  modulos: {
    codigo: string;
    nombre: string;
    descripcion: string;
    route: string;
    icono: string;
    orden: number;
    grupo: string | null;
    ambito: string;
    opciones: string[];
  }[];
};

/** `QueryRunner.query` devuelve `any`: se tipa la fila aquí. */
const filas = <T>(
  queryRunner: QueryRunner,
  sql: string,
  parametros?: unknown[],
): Promise<T> => queryRunner.query(sql, parametros) as Promise<T>;

const ROL_PLATAFORMA = 'Administrador de plataforma';

const AUDITORIA = `
  "fecha_registro" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "fecha_modificacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "id_estado" integer NOT NULL DEFAULT '1',
  "usuario_registro" integer,
  "usuario_modificacion" integer`;

export class Permisos1792291005000 implements MigrationInterface {
  name = 'Permisos1792291005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "rol_usuario" (${AUDITORIA},
        "id_negocio" integer,
        "id_rol_usuario" SERIAL NOT NULL,
        "nombre" character varying(100) NOT NULL,
        "descripcion" character varying(200),
        "es_fijo" boolean NOT NULL DEFAULT false,
        CONSTRAINT "pk_rol_usuario" PRIMARY KEY ("id_rol_usuario")
      )`);
    // Único por negocio y sin distinguir mayúsculas; `NULLS NOT DISTINCT`
    // (PG 15+) hace que el rol de plataforma (`id_negocio` nulo) tampoco se repita.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_rol_usuario_nombre" ON "rol_usuario" ("id_negocio", lower("nombre")) NULLS NOT DISTINCT WHERE id_estado = 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "rol_usuario" ADD CONSTRAINT "fk_rol_usuario_negocio" FOREIGN KEY ("id_negocio") REFERENCES "negocio"("id_negocio")`,
    );

    await queryRunner.query(`
      CREATE TABLE "modulo_sistema" (${AUDITORIA},
        "id_modulo_sistema" SERIAL NOT NULL,
        "id_grupo_modulo_sistema" integer,
        "codigo" character varying(50) NOT NULL,
        "nombre" character varying(100) NOT NULL,
        "descripcion" character varying(200) NOT NULL,
        "route" character varying(100),
        "icono" character varying(50) NOT NULL,
        "orden" integer NOT NULL,
        "tipo_modulo" character varying(10) NOT NULL,
        "ambito" character varying(10) NOT NULL,
        CONSTRAINT "ck_modulo_sistema_ambito" CHECK ("ambito" IN ('NEGOCIO', 'PLATAFORMA')),
        CONSTRAINT "ck_modulo_sistema_tipo" CHECK ("tipo_modulo" IN ('GRUPO', 'MENU')),
        CONSTRAINT "pk_modulo_sistema" PRIMARY KEY ("id_modulo_sistema")
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_modulo_sistema_codigo" ON "modulo_sistema" ("codigo")`,
    );
    await queryRunner.query(
      `ALTER TABLE "modulo_sistema" ADD CONSTRAINT "fk_modulo_sistema_grupo" FOREIGN KEY ("id_grupo_modulo_sistema") REFERENCES "modulo_sistema"("id_modulo_sistema")`,
    );

    await queryRunner.query(`
      CREATE TABLE "opcion_modulo_sistema" (${AUDITORIA},
        "id_opcion_modulo_sistema" SERIAL NOT NULL,
        "codigo" character varying(30) NOT NULL,
        "nombre" character varying(50) NOT NULL,
        "orden" integer NOT NULL,
        CONSTRAINT "pk_opcion_modulo_sistema" PRIMARY KEY ("id_opcion_modulo_sistema")
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_opcion_modulo_sistema_codigo" ON "opcion_modulo_sistema" ("codigo")`,
    );

    await queryRunner.query(`
      CREATE TABLE "modulo_opcion_sistema" (
        "id_modulo_sistema" integer NOT NULL,
        "id_opcion_modulo_sistema" integer NOT NULL,
        CONSTRAINT "pk_modulo_opcion_sistema" PRIMARY KEY ("id_modulo_sistema", "id_opcion_modulo_sistema"),
        CONSTRAINT "fk_modulo_opcion_modulo" FOREIGN KEY ("id_modulo_sistema") REFERENCES "modulo_sistema"("id_modulo_sistema"),
        CONSTRAINT "fk_modulo_opcion_opcion" FOREIGN KEY ("id_opcion_modulo_sistema") REFERENCES "opcion_modulo_sistema"("id_opcion_modulo_sistema")
      )`);

    await queryRunner.query(`
      CREATE TABLE "permiso_rol_usuario" (${AUDITORIA},
        "id_permiso_rol_usuario" SERIAL NOT NULL,
        "id_rol_usuario" integer NOT NULL,
        "id_modulo_sistema" integer NOT NULL,
        "id_opcion_modulo_sistema" integer NOT NULL,
        "activo" boolean NOT NULL,
        CONSTRAINT "pk_permiso_rol_usuario" PRIMARY KEY ("id_permiso_rol_usuario"),
        CONSTRAINT "fk_permiso_rol_usuario_rol" FOREIGN KEY ("id_rol_usuario") REFERENCES "rol_usuario"("id_rol_usuario"),
        CONSTRAINT "fk_permiso_rol_usuario_par" FOREIGN KEY ("id_modulo_sistema", "id_opcion_modulo_sistema") REFERENCES "modulo_opcion_sistema"("id_modulo_sistema", "id_opcion_modulo_sistema")
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_permiso_rol_usuario" ON "permiso_rol_usuario" ("id_rol_usuario", "id_modulo_sistema", "id_opcion_modulo_sistema")`,
    );

    await this.sembrarCatalogo(queryRunner);
    const idRolPlataforma = await this.sembrarRolPlataforma(queryRunner);
    await this.asignarRolAUsuarios(queryRunner, idRolPlataforma);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuario" DROP CONSTRAINT "fk_usuario_rol_usuario"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuario" DROP COLUMN "id_rol_usuario"`,
    );
    await queryRunner.query(`DROP TABLE "permiso_rol_usuario"`);
    await queryRunner.query(`DROP TABLE "modulo_opcion_sistema"`);
    await queryRunner.query(`DROP TABLE "opcion_modulo_sistema"`);
    await queryRunner.query(`DROP TABLE "modulo_sistema"`);
    await queryRunner.query(`DROP TABLE "rol_usuario"`);
  }

  private async sembrarCatalogo(queryRunner: QueryRunner): Promise<void> {
    const idOpcion = new Map<string, number>();
    for (const o of CATALOGO.opciones) {
      const [{ id }] = await filas<{ id: number }[]>(
        queryRunner,
        `INSERT INTO "opcion_modulo_sistema" (codigo, nombre, orden) VALUES ($1, $2, $3) RETURNING id_opcion_modulo_sistema AS id`,
        [o.codigo, o.nombre, o.orden],
      );
      idOpcion.set(o.codigo, id);
    }

    const idGrupo = new Map<string, number>();
    for (const g of CATALOGO.grupos) {
      const [{ id }] = await filas<{ id: number }[]>(
        queryRunner,
        `INSERT INTO "modulo_sistema" (codigo, nombre, descripcion, route, icono, orden, tipo_modulo, ambito)
         VALUES ($1, $2, $2, NULL, $3, $4, 'GRUPO', $5) RETURNING id_modulo_sistema AS id`,
        [g.codigo, g.nombre, g.icono, g.orden, g.ambito],
      );
      idGrupo.set(g.codigo, id);
    }

    for (const m of CATALOGO.modulos) {
      const [{ id }] = await filas<{ id: number }[]>(
        queryRunner,
        `INSERT INTO "modulo_sistema" (id_grupo_modulo_sistema, codigo, nombre, descripcion, route, icono, orden, tipo_modulo, ambito)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'MENU', $8) RETURNING id_modulo_sistema AS id`,
        [
          m.grupo ? idGrupo.get(m.grupo) : null,
          m.codigo,
          m.nombre,
          m.descripcion,
          m.route,
          m.icono,
          m.orden,
          m.ambito,
        ],
      );
      for (const opcion of m.opciones) {
        await queryRunner.query(
          `INSERT INTO "modulo_opcion_sistema" (id_modulo_sistema, id_opcion_modulo_sistema) VALUES ($1, $2)`,
          [id, idOpcion.get(opcion)],
        );
      }
    }
  }

  /** Rol de plataforma con todos los pares de los módulos de ámbito PLATAFORMA. */
  private async sembrarRolPlataforma(
    queryRunner: QueryRunner,
  ): Promise<number> {
    const [{ id }] = await filas<{ id: number }[]>(
      queryRunner,
      `INSERT INTO "rol_usuario" (id_negocio, nombre, descripcion, es_fijo)
       VALUES (NULL, $1, 'Administra la plataforma; no ve datos comerciales', true)
       RETURNING id_rol_usuario AS id`,
      [ROL_PLATAFORMA],
    );
    await queryRunner.query(
      `INSERT INTO "permiso_rol_usuario" (id_rol_usuario, id_modulo_sistema, id_opcion_modulo_sistema, activo)
       SELECT $1, mo.id_modulo_sistema, mo.id_opcion_modulo_sistema, true
       FROM "modulo_opcion_sistema" mo
       JOIN "modulo_sistema" m ON m.id_modulo_sistema = mo.id_modulo_sistema
       WHERE m.ambito = 'PLATAFORMA'`,
      [id],
    );
    return id;
  }

  /**
   * `usuario.id_rol_usuario` (decisión 85): nullable, se asigna el rol de
   * plataforma a los usuarios sin negocio y solo entonces `NOT NULL` + FK. Un
   * usuario de negocio no tiene rol que asignarle (antes de D2 no hay registro:
   * serían datos de prueba) y la migración aborta sin borrar nada.
   */
  private async asignarRolAUsuarios(
    queryRunner: QueryRunner,
    idRolPlataforma: number,
  ): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuario" ADD "id_rol_usuario" integer`,
    );
    await queryRunner.query(
      `UPDATE "usuario" SET id_rol_usuario = $1 WHERE id_negocio IS NULL`,
      [idRolPlataforma],
    );
    const [{ total }] = await filas<{ total: string }[]>(
      queryRunner,
      `SELECT count(*) AS total FROM "usuario" WHERE id_rol_usuario IS NULL`,
    );
    if (Number(total) > 0) {
      throw new Error(
        `Hay ${total} usuario(s) de negocio sin rol: no se sabe si eran Dueño o Empleado. ` +
          'Bórrelos o asígnelos a mano antes de migrar (la migración no borra datos).',
      );
    }
    await queryRunner.query(
      `ALTER TABLE "usuario" ALTER COLUMN "id_rol_usuario" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuario" ADD CONSTRAINT "fk_usuario_rol_usuario" FOREIGN KEY ("id_rol_usuario") REFERENCES "rol_usuario"("id_rol_usuario")`,
    );
  }
}
