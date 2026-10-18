import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { BaseAnulableEntity } from '../entities/base-anulable.entity';

/** Valor SQL crudo para TypeORM: `CURRENT_TIMESTAMP`, como el `@CreateDateColumn`/`@UpdateDateColumn`. */
export const AHORA_DEL_SERVIDOR = () => 'CURRENT_TIMESTAMP';

/** Largo máximo del motivo (`motivo_anulacion VARCHAR(500)`). */
export const MOTIVO_ANULACION_MAX = 500;

/** `FindOptionsWhere` de «activo»: no eliminado y no anulado. */
export const ACTIVO = { idEstado: 1, anulado: false } as const;

/** Fragmento SQL de «activo» para el alias de una tabla anulable. */
export function sqlActivo(alias: string): string {
  return `${alias}.id_estado = 1 AND NOT ${alias}.anulado`;
}

/**
 * Núcleo de la anulación: marca el registro, con fecha y motivo (el usuario lo
 * completa el suscriptor de auditoría). 400 si ya está anulado o si falta el
 * motivo. Las reglas propias de cada documento (stock, mes cerrado, asiento
 * inverso) las verifica quien llama, dentro de su transacción.
 */
export async function anularRegistro<T extends BaseAnulableEntity>(
  manager: EntityManager,
  registro: T,
  motivo: string | null | undefined,
  nombre: string,
): Promise<T> {
  const texto = (motivo ?? '').trim();
  if (!texto) {
    throw new BadRequestException(`Indique el motivo para anular ${nombre}.`);
  }
  if (texto.length > MOTIVO_ANULACION_MAX) {
    throw new BadRequestException(
      `El motivo debe tener como máximo ${MOTIVO_ANULACION_MAX} caracteres.`,
    );
  }
  if (registro.anulado) {
    throw new BadRequestException(`Ya se anuló ${nombre}.`);
  }
  registro.anulado = true;
  // Dato técnico (decisión 61): hora real del servidor de base de datos, igual
  // que fecha_registro; no el `Reloj`. La fecha de negocio de la anulación es
  // otra y la calcula quien llama.
  registro.fechaAnulacion = AHORA_DEL_SERVIDOR as unknown as Date;
  registro.motivoAnulacion = texto;
  return await manager.save(registro);
}

/** 400 si el registro está anulado: un anulado es inmutable. */
export function assertNoAnulado(
  registro: Pick<BaseAnulableEntity, 'anulado'>,
  mensaje: string,
): void {
  if (registro.anulado) throw new BadRequestException(mensaje);
}

/** ¿Activo? No eliminado y no anulado (versión en memoria de `ACTIVO`). */
export function esActivo(
  registro: Pick<BaseAnulableEntity, 'idEstado' | 'anulado'>,
): boolean {
  return registro.idEstado === 1 && !registro.anulado;
}
