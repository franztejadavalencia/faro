import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { NegocioIncorrectoError } from '../errors/negocio-incorrecto.error';
import { ExcepcionesFilter } from './excepciones.filter';

function ejecutar(excepcion: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  new ExcepcionesFilter().catch(excepcion, host);
  return {
    status: status.mock.calls[0][0] as number,
    cuerpo: json.mock.calls[0][0],
  };
}

/** Un `QueryFailedError` como el que lanza TypeORM con Postgres. */
function errorPg(codigo: string, detalle = 'detalle interno') {
  const driverError = Object.assign(new Error(detalle), {
    code: codigo,
    constraint: 'uq_secreta',
    table: 'tabla_secreta',
    detail: 'Key (usuario)=(ana) already exists.',
  });
  return new QueryFailedError('INSERT …', [], driverError);
}

describe('ExcepcionesFilter', () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('el detalle de la base va al log, no a la respuesta', () => {
    ejecutar(errorPg('23505', 'duplicate key value violates uq_secreta'));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('duplicate key value violates uq_secreta'),
    );
    ejecutar(new Error('boom'));
    expect(error).toHaveBeenCalledWith('boom', expect.any(String));
  });

  describe('HttpException: tal cual', () => {
    it.each([
      [new BadRequestException('Mes cerrado'), 400],
      [new NotFoundException('No existe'), 404],
      [new ServiceUnavailableException('La base de datos no responde'), 503],
    ])('%#', (excepcion, estado) => {
      const { status, cuerpo } = ejecutar(excepcion);
      expect(status).toBe(estado);
      expect(cuerpo).toEqual(excepcion.getResponse());
    });

    it('conserva message como arreglo (ValidationPipe)', () => {
      const excepcion = new BadRequestException(['a falta', 'b falta']);
      const { status, cuerpo } = ejecutar(excepcion);
      expect(status).toBe(400);
      expect(cuerpo.message).toEqual(['a falta', 'b falta']);
    });
  });

  it('23505 (único) → 409', () => {
    const { status, cuerpo } = ejecutar(errorPg('23505'));
    expect(status).toBe(409);
    expect(cuerpo).toEqual({
      statusCode: 409,
      message: 'Ya existe un registro con esos datos.',
      error: 'Conflict',
    });
  });

  it('23503 (FK) → 409', () => {
    const { status, cuerpo } = ejecutar(errorPg('23503'));
    expect(status).toBe(409);
    expect(cuerpo.error).toBe('Conflict');
  });

  it('23514 (CHECK) → 400', () => {
    const { status, cuerpo } = ejecutar(errorPg('23514'));
    expect(status).toBe(400);
    expect(cuerpo).toEqual({
      statusCode: 400,
      message: 'Los datos no cumplen una regla de validación.',
      error: 'Bad Request',
    });
  });

  it.each(['23502', 'P0001', '22P02', '40P01'])(
    'otro código de Postgres (%s) → 500',
    (codigo) => {
      expect(ejecutar(errorPg(codigo)).status).toBe(500);
    },
  );

  it.each([
    ['un Error cualquiera', new Error('boom')],
    ['NegocioIncorrectoError', new NegocioIncorrectoError('cruce')],
    ['algo que no es Error', 'texto'],
    ['null', null],
  ])('%s → 500 genérico', (_texto, excepcion) => {
    const { status, cuerpo } = ejecutar(excepcion);
    expect(status).toBe(500);
    expect(cuerpo).toEqual({
      statusCode: 500,
      message: 'Error interno del servidor',
      error: 'Internal Server Error',
    });
  });

  it.each(['23505', '23503', '23514', 'P0001'])(
    'la respuesta de %s no filtra tabla, restricción ni detalle de la base',
    (codigo) => {
      const texto = JSON.stringify(ejecutar(errorPg(codigo)).cuerpo);
      expect(texto).not.toMatch(
        /tabla_secreta|uq_secreta|ana|detalle interno|INSERT/,
      );
    },
  );
});
