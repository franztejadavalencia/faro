import { fechaDe } from '../utils/date.utils';

/**
 * Reloj de las **fechas de negocio** (decisión 61): «no posterior a hoy», el
 * periodo de un documento nuevo, la fecha por defecto. Se inyecta; nunca se
 * lee `new Date()` para esas reglas ni se usa `CURRENT_DATE` en SQL.
 *
 * Las fechas técnicas y de seguridad (`fecha_registro`, `fecha_anulacion`,
 * bitácora, JWT, bloqueo temporal, ventana TOTP) usan la hora real.
 *
 * El proveedor se elige por código (`CommonModule` provee `RelojSistema`; los
 * tests y el seed lo sustituyen con `RelojFijo`), no por variable de entorno.
 */
export abstract class Reloj {
  abstract ahora(): Date;

  /** Día de hoy (AAAA-MM-DD) en `ZONA_HORARIA`. */
  hoy(): string {
    return fechaDe(this.ahora());
  }
}
