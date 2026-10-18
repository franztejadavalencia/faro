import { Reloj } from './reloj';

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const SOLO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reloj que no avanza solo: se fija y se adelanta a mano. Solo para tests y
 * para el seed de demostración (decisión 60); nunca se registra en producción.
 */
export class RelojFijo extends Reloj {
  private instante: Date;

  constructor(fecha: Date | string) {
    super();
    this.instante = RelojFijo.aInstante(fecha);
  }

  ahora(): Date {
    return new Date(this.instante.getTime());
  }

  /** `AAAA-MM-DD` (mediodía de La Paz, para que `hoy()` dé ese día) o un instante. */
  fijar(fecha: Date | string): void {
    this.instante = RelojFijo.aInstante(fecha);
  }

  /** Adelanta (o atrasa, con negativo) el reloj en días enteros. */
  avanzar(dias: number): void {
    this.instante = new Date(this.instante.getTime() + dias * MS_POR_DIA);
  }

  private static aInstante(fecha: Date | string): Date {
    if (typeof fecha === 'string' && SOLO_DIA.test(fecha)) {
      // La Paz es UTC-4 todo el año (sin horario de verano).
      return new Date(`${fecha}T12:00:00-04:00`);
    }
    const instante = new Date(fecha);
    if (Number.isNaN(instante.getTime())) {
      throw new Error(`Fecha no válida para el reloj fijo: ${String(fecha)}`);
    }
    return instante;
  }
}
