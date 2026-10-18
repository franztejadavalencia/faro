import { Injectable } from '@nestjs/common';
import { Reloj } from './reloj';

/** El reloj real. Es el que usa la app en todos los entornos. */
@Injectable()
export class RelojSistema extends Reloj {
  ahora(): Date {
    return new Date();
  }
}
