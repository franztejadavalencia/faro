import { BadRequestException } from '@nestjs/common';

type DateValue = string | Date;

/**
 * Zona horaria única del sistema. La fecha de un instante y la zona de la
 * conexión a Postgres salen de aquí, no de la zona del servidor.
 * `ecosystem.config.js` (despliegue) la repite como TZ.
 */
export const ZONA_HORARIA = 'America/La_Paz';

/**
 * Día (AAAA-MM-DD) que corresponde a un instante en `ZONA_HORARIA`. No usar
 * `toISOString().slice(0, 10)`: da la fecha UTC, que desde las 20:00 (UTC-4)
 * ya es el día siguiente.
 *
 * Es pura: «hoy» se pide al `Reloj` (`reloj.hoy()`), nunca se lee aquí
 * (decisión 61; por eso no se porta `fechaHoy()` de SIAP).
 */
export function fechaDe(instante: Date): string {
  return instante.toLocaleDateString('en-CA', { timeZone: ZONA_HORARIA });
}

/** `AAAA-MM-DD` → `DD/MM/AAAA`, para mensajes al usuario. */
export function fechaLegible(dia: string): string {
  const [anio, mes, diaMes] = dia.split('-');
  return `${diaMes}/${mes}/${anio}`;
}

export function validateDateRange(
  startDate: DateValue,
  endDate?: DateValue | null,
  startField = 'fecha de inicio',
  endField = 'fecha de fin',
): void {
  if (endDate == null) return;

  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime();

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    throw new BadRequestException('Las fechas proporcionadas no son válidas.');
  }

  if (endTime < startTime) {
    throw new BadRequestException(
      `La fecha ${endField} no puede ser anterior a ${startField}.`,
    );
  }
}
