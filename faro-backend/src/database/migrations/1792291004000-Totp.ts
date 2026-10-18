import { MigrationInterface, QueryRunner } from 'typeorm';

/** B5: una 2FA activa exige el secreto (cifrado) guardado. */
export class Totp1792291004000 implements MigrationInterface {
  name = 'Totp1792291004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuario" ADD CONSTRAINT "ck_usuario_totp" CHECK (NOT "totp_activo" OR "totp_secreto" IS NOT NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuario" DROP CONSTRAINT "ck_usuario_totp"`,
    );
  }
}
