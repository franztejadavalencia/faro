import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseNegocioOpcionalEntity } from '@common/entities';
import { Negocio } from '@plataforma/entities/negocio.entity';
import { RolUsuario } from '../permiso/entities/rol-usuario.entity';
import { Persona } from './persona.entity';

/**
 * El login es único en **toda la plataforma** (decisión 43): el login no pide
 * el negocio. Lo garantiza el índice `uq_usuario_login` sobre `lower(usuario)`,
 * que vive en la migración (TypeORM no declara índices de expresión; el
 * `synchronize: false` lo excluye del `migration:generate`).
 */
@Entity('usuario')
@Index('uq_usuario_login', { synchronize: false })
@Index('uq_usuario_persona', ['idPersona'], {
  unique: true,
  where: 'id_estado = 1',
})
@Check('ck_usuario_intentos_fallidos', `"intentos_fallidos" >= 0`)
@Check('ck_usuario_version_sesion', `"version_sesion" >= 0`)
@Check('ck_usuario_totp', `NOT "totp_activo" OR "totp_secreto" IS NOT NULL`)
export class Usuario extends BaseNegocioOpcionalEntity {
  @PrimaryGeneratedColumn({
    name: 'id_usuario',
    primaryKeyConstraintName: 'pk_usuario',
  })
  idUsuario!: number;

  @ManyToOne(() => Negocio, { nullable: true })
  @JoinColumn({
    name: 'id_negocio',
    foreignKeyConstraintName: 'fk_usuario_negocio',
  })
  negocio?: Negocio | null;

  @Column({ type: 'varchar', length: 100 })
  usuario!: string;

  /** Hash bcrypt, nunca la clave. */
  @Column({ type: 'varchar', length: 100, select: false })
  clave!: string;

  @Column({ name: 'id_persona', type: 'integer' })
  idPersona!: number;

  @ManyToOne(() => Persona, { nullable: false })
  @JoinColumn({
    name: 'id_persona',
    foreignKeyConstraintName: 'fk_usuario_persona',
  })
  persona?: Persona;

  /** Un usuario tiene un rol (el del negocio, o el de plataforma del admin). */
  @Column({ name: 'id_rol_usuario', type: 'integer' })
  idRolUsuario!: number;

  @ManyToOne(() => RolUsuario, { nullable: false })
  @JoinColumn({
    name: 'id_rol_usuario',
    foreignKeyConstraintName: 'fk_usuario_rol_usuario',
  })
  rol?: RolUsuario;

  @Column({ name: 'debe_cambiar_clave', type: 'boolean', default: false })
  debeCambiarClave!: boolean;

  /**
   * El texto **cifrado** del secreto TOTP, nunca el secreto: AES-256-GCM con
   * `TOTP_CLAVE_CIFRADO` y AAD por usuario, formato `v1:<iv>:<etiqueta>:<cifrado>`
   * (`utils/cifrado-totp.ts`). `null` hasta configurar la 2FA; con
   * `totp_activo = true` es obligatorio (`ck_usuario_totp`).
   */
  @Column({ name: 'totp_secreto', type: 'text', nullable: true, select: false })
  totpSecreto!: string | null;

  @Column({ name: 'totp_activo', type: 'boolean', default: false })
  totpActivo!: boolean;

  /** Paso de 30 s del último código aceptado (antirreúso, decisión 50). */
  @Column({ name: 'totp_ultimo_paso', type: 'integer', nullable: true })
  totpUltimoPaso!: number | null;

  @Column({ name: 'intentos_fallidos', type: 'integer', default: 0 })
  intentosFallidos!: number;

  @Column({ name: 'bloqueado_hasta', type: 'timestamptz', nullable: true })
  bloqueadoHasta!: Date | null;

  /**
   * Va en el JWT; el guard rechaza un token con otra versión (como el
   * SecurityStamp de ASP.NET Identity). **Sube** al cambiar la clave (B4), al
   * restablecerla (B7) y al activar o desactivar la 2FA (B5): cierra las demás
   * sesiones. **No sube** al desbloquear (el bloqueo no corta sesiones) ni al
   * desactivar al usuario (el guard ya revisa `id_estado`).
   */
  @Column({ name: 'version_sesion', type: 'integer', default: 0 })
  versionSesion!: number;
}
