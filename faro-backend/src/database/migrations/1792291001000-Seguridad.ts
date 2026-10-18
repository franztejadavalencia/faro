import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B3: `persona`, `usuario` y `usuario_codigo_respaldo`. `id_negocio` es nullable
 * en persona y usuario (plataforma). Sin `id_rol_usuario`: llega con B6.
 */
export class Seguridad1792291001000 implements MigrationInterface {
  name = 'Seguridad1792291001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "persona" (
        "fecha_registro" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "fecha_modificacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "id_estado" integer NOT NULL DEFAULT '1',
        "usuario_registro" integer,
        "usuario_modificacion" integer,
        "id_negocio" integer,
        "id_persona" SERIAL NOT NULL,
        "tipo" character varying(10) NOT NULL,
        "nombre" character varying(200) NOT NULL,
        "paterno" character varying(100),
        "materno" character varying(100),
        "tipo_documento" character varying(10),
        "documento" character varying(30),
        "correo" character varying(150),
        "telefono" character varying(30),
        CONSTRAINT "ck_persona_apellidos_natural" CHECK ("tipo" = 'NATURAL' OR ("paterno" IS NULL AND "materno" IS NULL)),
        CONSTRAINT "ck_persona_documento_completo" CHECK (("tipo_documento" IS NULL) = ("documento" IS NULL)),
        CONSTRAINT "ck_persona_tipo_documento" CHECK ("tipo_documento" IS NULL OR "tipo_documento" IN ('CI', 'NIT', 'OTRO')),
        CONSTRAINT "ck_persona_tipo" CHECK ("tipo" IN ('NATURAL', 'JURIDICA')),
        CONSTRAINT "pk_persona" PRIMARY KEY ("id_persona")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_persona_documento" ON "persona" ("id_negocio", "tipo_documento", "documento") WHERE documento IS NOT NULL AND id_estado = 1`,
    );

    await queryRunner.query(`
      CREATE TABLE "usuario" (
        "fecha_registro" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "fecha_modificacion" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "id_estado" integer NOT NULL DEFAULT '1',
        "usuario_registro" integer,
        "usuario_modificacion" integer,
        "id_negocio" integer,
        "id_usuario" SERIAL NOT NULL,
        "usuario" character varying(100) NOT NULL,
        "clave" character varying(100) NOT NULL,
        "id_persona" integer NOT NULL,
        "debe_cambiar_clave" boolean NOT NULL DEFAULT false,
        "totp_secreto" text,
        "totp_activo" boolean NOT NULL DEFAULT false,
        "totp_ultimo_paso" integer,
        "intentos_fallidos" integer NOT NULL DEFAULT '0',
        "bloqueado_hasta" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "ck_usuario_intentos_fallidos" CHECK ("intentos_fallidos" >= 0),
        CONSTRAINT "pk_usuario" PRIMARY KEY ("id_usuario")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_usuario_persona" ON "usuario" ("id_persona") WHERE id_estado = 1`,
    );
    // El login es único en toda la plataforma, sin distinguir mayúsculas (decisión 43).
    // TypeORM no declara índices de expresión: la entidad lo marca con `synchronize: false`.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_usuario_login" ON "usuario" (lower("usuario")) WHERE id_estado = 1`,
    );

    await queryRunner.query(`
      CREATE TABLE "usuario_codigo_respaldo" (
        "id_usuario_codigo_respaldo" SERIAL NOT NULL,
        "id_usuario" integer NOT NULL,
        "hash" character varying(100) NOT NULL,
        "usado_en" TIMESTAMP WITH TIME ZONE,
        "fecha_registro" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_usuario_codigo_respaldo" PRIMARY KEY ("id_usuario_codigo_respaldo")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_codigo_respaldo_usuario" ON "usuario_codigo_respaldo" ("id_usuario")`,
    );

    await queryRunner.query(
      `ALTER TABLE "persona" ADD CONSTRAINT "fk_persona_negocio" FOREIGN KEY ("id_negocio") REFERENCES "negocio"("id_negocio") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuario" ADD CONSTRAINT "fk_usuario_negocio" FOREIGN KEY ("id_negocio") REFERENCES "negocio"("id_negocio") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuario" ADD CONSTRAINT "fk_usuario_persona" FOREIGN KEY ("id_persona") REFERENCES "persona"("id_persona") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuario_codigo_respaldo" ADD CONSTRAINT "fk_codigo_respaldo_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuario_codigo_respaldo" DROP CONSTRAINT "fk_codigo_respaldo_usuario"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuario" DROP CONSTRAINT "fk_usuario_persona"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuario" DROP CONSTRAINT "fk_usuario_negocio"`,
    );
    await queryRunner.query(
      `ALTER TABLE "persona" DROP CONSTRAINT "fk_persona_negocio"`,
    );
    await queryRunner.query(`DROP INDEX "public"."ix_codigo_respaldo_usuario"`);
    await queryRunner.query(`DROP TABLE "usuario_codigo_respaldo"`);
    await queryRunner.query(`DROP INDEX "public"."uq_usuario_login"`);
    await queryRunner.query(`DROP INDEX "public"."uq_usuario_persona"`);
    await queryRunner.query(`DROP TABLE "usuario"`);
    await queryRunner.query(`DROP INDEX "public"."uq_persona_documento"`);
    await queryRunner.query(`DROP TABLE "persona"`);
  }
}
