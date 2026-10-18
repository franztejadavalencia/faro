import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Decimal } from 'decimal.js';
import { lastValueFrom, of } from 'rxjs';
import { MODULOS } from '../constants/modulos';
import { OMITIR_SIN_VER_COSTOS } from '../decorators/omitir-sin-ver-costos.decorator';
import { PermisoService } from '../services/permiso.service';
import {
  OmitirCostosInterceptor,
  omitirCampos,
} from './omitir-costos.interceptor';

const CAMPOS = new Set(['costoUnitario', 'valor']);

describe('omitirCampos', () => {
  it('quita las claves en cualquier nivel de objetos y arreglos', () => {
    const entrada = {
      nombre: 'Leche',
      costoUnitario: '3.5000',
      detalle: [
        { id: 1, costoUnitario: '3.0000', lote: { valor: '9.00', n: 2 } },
      ],
    };
    expect(omitirCampos(entrada, CAMPOS)).toEqual({
      nombre: 'Leche',
      detalle: [{ id: 1, lote: { n: 2 } }],
    });
  });

  it('no muta la entrada', () => {
    const entrada = { costoUnitario: '1', otro: { valor: '2' } };
    omitirCampos(entrada, CAMPOS);
    expect(entrada).toEqual({ costoUnitario: '1', otro: { valor: '2' } });
  });

  it('conserva fechas, Decimal, nulos y primitivos', () => {
    const fecha = new Date('2026-10-18T00:00:00Z');
    const decimal = new Decimal('12.50');
    const salida = omitirCampos(
      { fecha, monto: decimal, nada: null, n: 3, texto: 'a' },
      CAMPOS,
    ) as Record<string, unknown>;
    expect(salida.fecha).toBe(fecha);
    expect(salida.monto).toBe(decimal);
    expect(salida).toMatchObject({ nada: null, n: 3, texto: 'a' });
  });

  it('también recorre instancias de clase (entidades, DTO)', () => {
    class Fila {
      nombre = 'x';
      costoUnitario = '1';
    }
    expect(omitirCampos([new Fila()], CAMPOS)).toEqual([{ nombre: 'x' }]);
  });
});

describe('OmitirCostosInterceptor', () => {
  function armar(
    opciones: {
      omision?: { modulo: string; campos: string[] };
      rolActual?: { idRolUsuario: number };
      verCostos?: boolean;
    } = {},
  ) {
    const permisos = {
      tiene: jest.fn().mockResolvedValue(opciones.verCostos ?? false),
    };
    const reflector = {
      getAllAndOverride: jest.fn((clave: string) =>
        clave === OMITIR_SIN_VER_COSTOS ? opciones.omision : undefined,
      ),
    } as unknown as Reflector;
    const interceptor = new OmitirCostosInterceptor(
      reflector,
      permisos as unknown as PermisoService,
    );
    const contexto = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({ rolActual: opciones.rolActual }),
      }),
    } as unknown as ExecutionContext;
    const cuerpo = { nombre: 'Leche', costoUnitario: '3.5000' };
    const siguiente: CallHandler = { handle: () => of(cuerpo) };
    const ejecutar = async () =>
      lastValueFrom(await interceptor.intercept(contexto, siguiente));
    return { ejecutar, permisos, cuerpo };
  }

  const omision = { modulo: MODULOS.PRODUCTOS, campos: ['costoUnitario'] };

  it('sin ver_costos quita los campos declarados', async () => {
    const { ejecutar, permisos } = armar({
      omision,
      rolActual: { idRolUsuario: 2 },
    });
    await expect(ejecutar()).resolves.toEqual({ nombre: 'Leche' });
    expect(permisos.tiene).toHaveBeenCalledWith(2, 'productos', 'ver_costos');
  });

  it('con ver_costos deja la respuesta intacta', async () => {
    const { ejecutar, cuerpo } = armar({
      omision,
      rolActual: { idRolUsuario: 2 },
      verCostos: true,
    });
    await expect(ejecutar()).resolves.toBe(cuerpo);
  });

  it('falla cerrado: sin rol en el request también los quita', async () => {
    const { ejecutar, permisos } = armar({ omision });
    await expect(ejecutar()).resolves.toEqual({ nombre: 'Leche' });
    expect(permisos.tiene).not.toHaveBeenCalled();
  });

  it('una ruta sin la marca no se toca', async () => {
    const { ejecutar, cuerpo, permisos } = armar({
      rolActual: { idRolUsuario: 2 },
    });
    await expect(ejecutar()).resolves.toBe(cuerpo);
    expect(permisos.tiene).not.toHaveBeenCalled();
  });
});
