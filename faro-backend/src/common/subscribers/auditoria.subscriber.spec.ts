import { DataSource, InsertEvent, UpdateEvent } from 'typeorm';
import { BaseAnulableEntity } from '../entities/base-anulable.entity';
import { BaseEntity } from '../entities/base.entity';
import { BaseNegocioEntity } from '../entities/base-negocio.entity';
import { BaseNegocioOpcionalEntity } from '../entities/base-negocio-opcional.entity';
import { NegocioIncorrectoError } from '../errors/negocio-incorrecto.error';
import {
  ContextoRequest,
  RequestContextService,
} from '../services/request-context.service';
import { AuditoriaSubscriber } from './auditoria.subscriber';

class Simple extends BaseEntity {}
class DeNegocio extends BaseNegocioEntity {}
class Anulable extends BaseAnulableEntity {}
class Opcional extends BaseNegocioOpcionalEntity {}

const metadata = { name: 'Prueba' };

function armar() {
  const contexto = new RequestContextService();
  const dataSource = { subscribers: [] as unknown[] } as unknown as DataSource;
  const subscriber = new AuditoriaSubscriber(dataSource, contexto);
  const en = <T>(ctx: ContextoRequest | undefined, fn: () => T): T =>
    ctx ? contexto.ejecutarConContexto(ctx, fn) : fn();
  return { subscriber, dataSource, en };
}

const insertar = (entity: unknown) =>
  ({ entity, metadata }) as unknown as InsertEvent<unknown>;
const actualizar = (entity: unknown, databaseEntity?: unknown) =>
  ({ entity, databaseEntity, metadata }) as unknown as UpdateEvent<unknown>;

const como = <T extends object>(Clase: new () => T, datos: Partial<T> = {}) =>
  Object.assign(new Clase(), datos);

describe('AuditoriaSubscriber', () => {
  it('se registra en el DataSource', () => {
    const { subscriber, dataSource } = armar();
    expect(dataSource.subscribers).toContain(subscriber);
  });

  describe('beforeInsert', () => {
    it('pone usuarioRegistro del contexto', () => {
      const { subscriber, en } = armar();
      const e = como(Simple);
      en({ idUsuario: 5 }, () => subscriber.beforeInsert(insertar(e)));
      expect(e.usuarioRegistro).toBe(5);
    });

    it('sin contexto no hace nada', () => {
      const { subscriber } = armar();
      const e = como(DeNegocio);
      subscriber.beforeInsert(insertar(e));
      expect(e.usuarioRegistro).toBeUndefined();
      expect(e.idNegocio).toBeUndefined();
    });

    it('ignora lo que no es BaseEntity', () => {
      const { subscriber, en } = armar();
      const e = { usuarioRegistro: undefined };
      en({ idUsuario: 5, idNegocio: 7 }, () =>
        subscriber.beforeInsert(insertar(e)),
      );
      expect(e.usuarioRegistro).toBeUndefined();
    });

    it('pone idNegocio del contexto si la entidad no lo trae', () => {
      const { subscriber, en } = armar();
      const e = como(DeNegocio);
      en({ idUsuario: 5, idNegocio: 7 }, () =>
        subscriber.beforeInsert(insertar(e)),
      );
      expect(e.idNegocio).toBe(7);
    });

    it('acepta el mismo idNegocio', () => {
      const { subscriber, en } = armar();
      const e = como(DeNegocio, { idNegocio: 7 });
      expect(() =>
        en({ idUsuario: 5, idNegocio: 7 }, () =>
          subscriber.beforeInsert(insertar(e)),
        ),
      ).not.toThrow();
    });

    it('rechaza un idNegocio distinto al del contexto', () => {
      const { subscriber, en } = armar();
      const e = como(DeNegocio, { idNegocio: 8 });
      expect(() =>
        en({ idUsuario: 5, idNegocio: 7 }, () =>
          subscriber.beforeInsert(insertar(e)),
        ),
      ).toThrow(NegocioIncorrectoError);
    });

    it('sin idNegocio en el contexto (registro, seed, plataforma) respeta el de la entidad', () => {
      const { subscriber, en } = armar();
      const e = como(DeNegocio, { idNegocio: 8 });
      expect(() =>
        en({ idUsuario: 5, idNegocio: null }, () =>
          subscriber.beforeInsert(insertar(e)),
        ),
      ).not.toThrow();
      expect(e.idNegocio).toBe(8);
    });
  });

  describe('beforeUpdate', () => {
    it('pone usuarioModificacion', () => {
      const { subscriber, en } = armar();
      const e = como(Simple);
      en({ idUsuario: 5 }, () => subscriber.beforeUpdate(actualizar(e)));
      expect(e.usuarioModificacion).toBe(5);
    });

    it('sin entity (QueryBuilder) o sin contexto no hace nada', () => {
      const { subscriber } = armar();
      const e = como(Simple);
      expect(() =>
        subscriber.beforeUpdate(actualizar(undefined)),
      ).not.toThrow();
      subscriber.beforeUpdate(actualizar(e));
      expect(e.usuarioModificacion).toBeUndefined();
    });

    it('al anular deja a quien anula como usuarioAnulacion, una sola vez', () => {
      const { subscriber, en } = armar();
      const e = como(Anulable, {
        idNegocio: 7,
        anulado: true,
        usuarioAnulacion: null,
      });
      en({ idUsuario: 5, idNegocio: 7 }, () =>
        subscriber.beforeUpdate(actualizar(e, { idNegocio: 7 })),
      );
      expect(e.usuarioAnulacion).toBe(5);
      en({ idUsuario: 9, idNegocio: 7 }, () =>
        subscriber.beforeUpdate(actualizar(e, { idNegocio: 7 })),
      );
      expect(e.usuarioAnulacion).toBe(5);
    });

    it('no pone usuarioAnulacion si no está anulado', () => {
      const { subscriber, en } = armar();
      const e = como(Anulable, { idNegocio: 7, anulado: false });
      en({ idUsuario: 5, idNegocio: 7 }, () =>
        subscriber.beforeUpdate(actualizar(e, { idNegocio: 7 })),
      );
      expect(e.usuarioAnulacion).toBeUndefined();
    });

    it('rechaza guardar una fila de otro negocio', () => {
      const { subscriber, en } = armar();
      const e = como(DeNegocio, { idNegocio: 8 });
      expect(() =>
        en({ idUsuario: 5, idNegocio: 7 }, () =>
          subscriber.beforeUpdate(actualizar(e, { idNegocio: 8 })),
        ),
      ).toThrow(NegocioIncorrectoError);
    });

    it('rechaza cambiar el idNegocio de una fila existente, aunque no haya contexto', () => {
      const { subscriber } = armar();
      const e = como(DeNegocio, { idNegocio: 9 });
      expect(() =>
        subscriber.beforeUpdate(actualizar(e, { idNegocio: 8 })),
      ).toThrow(/no se puede cambiar idNegocio/);
    });

    it('rechaza pasar de un negocio a null y de null a un negocio', () => {
      const { subscriber } = armar();
      expect(() =>
        subscriber.beforeUpdate(
          actualizar(como(DeNegocio, { idNegocio: null as never }), {
            idNegocio: 8,
          }),
        ),
      ).toThrow(NegocioIncorrectoError);
      expect(() =>
        subscriber.beforeUpdate(
          actualizar(como(DeNegocio, { idNegocio: 8 }), {
            idNegocio: null as never,
          }),
        ),
      ).toThrow(NegocioIncorrectoError);
    });

    it('sin contexto de negocio permite guardar una fila sin cambiar su idNegocio', () => {
      const { subscriber, en } = armar();
      const e = como(DeNegocio, { idNegocio: 8 });
      expect(() =>
        en({ idUsuario: 1, idNegocio: null }, () =>
          subscriber.beforeUpdate(actualizar(e, { idNegocio: 8 })),
        ),
      ).not.toThrow();
    });

    it('una entidad cargada sin idNegocio (parcial) no se considera cambio', () => {
      const { subscriber, en } = armar();
      const e = como(DeNegocio);
      expect(() =>
        en({ idUsuario: 1, idNegocio: 7 }, () =>
          subscriber.beforeUpdate(actualizar(e, { idNegocio: 7 })),
        ),
      ).not.toThrow();
    });
  });
});

describe('AuditoriaSubscriber con BaseNegocioOpcionalEntity (persona, usuario)', () => {
  it('un contexto con negocio no crea filas de plataforma: pone el del contexto', () => {
    const { subscriber, en } = armar();
    const e = como(Opcional, { idNegocio: null });
    en({ idUsuario: 5, idNegocio: 7 }, () =>
      subscriber.beforeInsert(insertar(e)),
    );
    expect(e.idNegocio).toBe(7);
  });

  it('sin contexto (seed, admin) respeta el null de plataforma', () => {
    const { subscriber } = armar();
    const e = como(Opcional, { idNegocio: null });
    subscriber.beforeInsert(insertar(e));
    expect(e.idNegocio).toBeNull();
  });

  it('un contexto de plataforma (sin negocio) respeta el null', () => {
    const { subscriber, en } = armar();
    const e = como(Opcional, { idNegocio: null });
    en({ idUsuario: 1, idNegocio: null }, () =>
      subscriber.beforeInsert(insertar(e)),
    );
    expect(e.idNegocio).toBeNull();
  });

  it('un contexto con negocio no puede guardar una fila de plataforma', () => {
    const { subscriber, en } = armar();
    const e = como(Opcional, { idNegocio: null });
    expect(() =>
      en({ idUsuario: 5, idNegocio: 7 }, () =>
        subscriber.beforeUpdate(actualizar(e, { idNegocio: null })),
      ),
    ).toThrow(NegocioIncorrectoError);
  });

  it('una fila de plataforma no pasa a un negocio', () => {
    const { subscriber } = armar();
    const e = como(Opcional, { idNegocio: 7 });
    expect(() =>
      subscriber.beforeUpdate(actualizar(e, { idNegocio: null })),
    ).toThrow(NegocioIncorrectoError);
  });
});
