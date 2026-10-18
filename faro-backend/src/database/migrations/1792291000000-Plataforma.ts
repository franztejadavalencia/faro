import { MigrationInterface, QueryRunner } from 'typeorm';

/** B3: `negocio` mínimo (D1 le agrega el resto de las columnas). */
export class Plataforma1792291000000 implements MigrationInterface {
  name = 'Plataforma1792291000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "negocio" (
        "fecha_registro" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "fecha_modificacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "id_estado" integer NOT NULL DEFAULT '1',
        "usuario_registro" integer,
        "usuario_modificacion" integer,
        "id_negocio" SERIAL NOT NULL,
        "nombre" character varying(200) NOT NULL,
        "estado" character varying(20) NOT NULL DEFAULT 'ACTIVO',
        CONSTRAINT "ck_negocio_estado" CHECK ("estado" IN ('ACTIVO', 'SUSPENDIDO')),
        CONSTRAINT "pk_negocio" PRIMARY KEY ("id_negocio")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "negocio"`);
  }
}
