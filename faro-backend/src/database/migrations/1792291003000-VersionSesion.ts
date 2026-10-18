import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B4: `usuario.version_sesion`, que va en el JWT. Subirla invalida los tokens
 * emitidos antes (cambio de clave, restablecimiento, 2FA).
 */
export class VersionSesion1792291003000 implements MigrationInterface {
  name = 'VersionSesion1792291003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuario" ADD "version_sesion" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuario" ADD CONSTRAINT "ck_usuario_version_sesion" CHECK ("version_sesion" >= 0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuario" DROP CONSTRAINT "ck_usuario_version_sesion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usuario" DROP COLUMN "version_sesion"`,
    );
  }
}
