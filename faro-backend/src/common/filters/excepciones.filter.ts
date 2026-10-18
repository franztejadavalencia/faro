import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { getErrorMessage, getPgErrorCode } from '../utils/error-message';

const UNICO = '23505';
const FORANEA = '23503';
const CHECK = '23514';

interface Respuesta {
  statusCode: number;
  message: string;
  error: string;
}

/**
 * Filtro global (decisión 32, `architecture.md` §10). Reemplaza el «todo es
 * 400» de `handleServiceError` de SIAP:
 *
 * | Origen                          | Respuesta |
 * |---------------------------------|-----------|
 * | `HttpException`                 | tal cual  |
 * | Postgres 23505 (único)          | 409       |
 * | Postgres 23503 (FK)             | 409       |
 * | Postgres 23514 (CHECK)          | 400       |
 * | el resto (incluido un asiento descuadrado) | 500, mensaje genérico |
 *
 * La respuesta nunca trae la restricción, la tabla ni el detalle de Postgres:
 * van al log.
 */
@Catch()
export class ExcepcionesFilter implements ExceptionFilter {
  private readonly logger = new Logger(ExcepcionesFilter.name);

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (excepcion instanceof HttpException) {
      response.status(excepcion.getStatus()).json(excepcion.getResponse());
      return;
    }

    const respuesta = this.traducir(excepcion);
    response.status(respuesta.statusCode).json(respuesta);
  }

  private traducir(excepcion: unknown): Respuesta {
    const codigo = getPgErrorCode(excepcion);

    if (codigo === UNICO || codigo === FORANEA) {
      this.logger.warn(`Postgres ${codigo}: ${getErrorMessage(excepcion)}`);
      return {
        statusCode: HttpStatus.CONFLICT,
        message:
          codigo === UNICO
            ? 'Ya existe un registro con esos datos.'
            : 'El registro está relacionado con otros datos o referencia uno que no existe.',
        error: 'Conflict',
      };
    }

    if (codigo === CHECK) {
      this.logger.warn(`Postgres ${codigo}: ${getErrorMessage(excepcion)}`);
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Los datos no cumplen una regla de validación.',
        error: 'Bad Request',
      };
    }

    this.logger.error(
      getErrorMessage(excepcion),
      excepcion instanceof Error ? excepcion.stack : undefined,
    );
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error interno del servidor',
      error: 'Internal Server Error',
    };
  }
}
