import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B3: `bitacora` de solo inserción (decisión 51). `fn_solo_insercion()` es
 * genérica: D3 la reutiliza en `asiento` y `asiento_detalle`. El trigger no
 * protege del dueño de la tabla (puede desactivarlo o hacer `TRUNCATE`): en
 * producción el usuario de la app no es dueño (`architecture.md` §2).
 */
export class Bitacora1792291002000 implements MigrationInterface {
  name = 'Bitacora1792291002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bitacora" (
        "id_bitacora" SERIAL NOT NULL,
        "id_negocio" integer,
        "id_usuario" integer,
        "evento" character varying(100) NOT NULL,
        "detalle" jsonb,
        "ip" character varying(64),
        "user_agent" text,
        "url" text,
        "metodo" character varying(10),
        "fecha" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_bitacora" PRIMARY KEY ("id_bitacora")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_bitacora_usuario_fecha" ON "bitacora" ("id_usuario", "fecha")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_bitacora_negocio_fecha" ON "bitacora" ("id_negocio", "fecha")`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" ADD CONSTRAINT "fk_bitacora_negocio" FOREIGN KEY ("id_negocio") REFERENCES "negocio"("id_negocio") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" ADD CONSTRAINT "fk_bitacora_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`
      CREATE FUNCTION fn_solo_insercion() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'La tabla % es de solo inserción: no admite %.', TG_TABLE_NAME, TG_OP
          USING ERRCODE = 'restrict_violation';
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER tr_bitacora_solo_insercion
      BEFORE UPDATE OR DELETE ON "bitacora"
      FOR EACH ROW EXECUTE FUNCTION fn_solo_insercion()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER tr_bitacora_solo_insercion ON "bitacora"`,
    );
    await queryRunner.query(`DROP FUNCTION fn_solo_insercion()`);
    await queryRunner.query(
      `ALTER TABLE "bitacora" DROP CONSTRAINT "fk_bitacora_usuario"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" DROP CONSTRAINT "fk_bitacora_negocio"`,
    );
    await queryRunner.query(`DROP INDEX "public"."ix_bitacora_negocio_fecha"`);
    await queryRunner.query(`DROP INDEX "public"."ix_bitacora_usuario_fecha"`);
    await queryRunner.query(`DROP TABLE "bitacora"`);
  }
}
