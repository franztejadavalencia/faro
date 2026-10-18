import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ES_PUBLICO } from '@common/decorators/publico.decorator';
import { MODULOS } from '../constants/modulos';
import { OPCIONES } from '../constants/opciones';
import { REQUIERE_PERMISO } from '../decorators/requiere-permiso.decorator';
import { SOLO_AUTENTICADO } from '../decorators/solo-autenticado.decorator';
import { PermisoService } from '../services/permiso.service';
import { MENSAJE_SIN_PERMISO, PermisoGuard } from './permiso.guard';

class Controlador {
  ruta(): void {}
}

function armar(
  marcas: Record<string, unknown>,
  rolActual: { idRolUsuario: number } | undefined,
  tiene = true,
) {
  const permisos = { tiene: jest.fn().mockResolvedValue(tiene) };
  const reflector = {
    getAllAndOverride: jest.fn((clave: string) => marcas[clave]),
  } as unknown as Reflector;
  const guard = new PermisoGuard(
    reflector,
    permisos as unknown as PermisoService,
  );
  const contexto = {
    getHandler: () => Controlador.prototype.ruta,
    getClass: () => Controlador,
    switchToHttp: () => ({ getRequest: () => ({ rolActual }) }),
  } as unknown as ExecutionContext;
  return { guard, contexto, permisos };
}

const REQUERIDO = { modulo: MODULOS.PRODUCTOS, opcion: OPCIONES.CREAR };

describe('PermisoGuard', () => {
  it('una ruta @Publico pasa sin consultar permisos', async () => {
    const { guard, contexto, permisos } = armar(
      { [ES_PUBLICO]: true },
      undefined,
    );
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(permisos.tiene).not.toHaveBeenCalled();
  });

  it('con @RequierePermiso y el permiso activo, pasa', async () => {
    const { guard, contexto, permisos } = armar(
      { [REQUIERE_PERMISO]: REQUERIDO },
      { idRolUsuario: 4 },
    );
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(permisos.tiene).toHaveBeenCalledWith(4, 'productos', 'crear');
  });

  it('con @RequierePermiso y sin el permiso, 403', async () => {
    const { guard, contexto } = armar(
      { [REQUIERE_PERMISO]: REQUERIDO },
      { idRolUsuario: 4 },
      false,
    );
    await expect(guard.canActivate(contexto)).rejects.toThrow(
      new ForbiddenException(MENSAJE_SIN_PERMISO),
    );
  });

  it('con @RequierePermiso y sin rol en el request, 403 sin consultar', async () => {
    const { guard, contexto, permisos } = armar(
      { [REQUIERE_PERMISO]: REQUERIDO },
      undefined,
    );
    await expect(guard.canActivate(contexto)).rejects.toThrow(
      ForbiddenException,
    );
    expect(permisos.tiene).not.toHaveBeenCalled();
  });

  it('@SoloAutenticado pasa sin consultar permisos', async () => {
    const { guard, contexto, permisos } = armar(
      { [SOLO_AUTENTICADO]: true },
      { idRolUsuario: 4 },
    );
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(permisos.tiene).not.toHaveBeenCalled();
  });

  it('@RequierePermiso manda sobre @SoloAutenticado', async () => {
    const { guard, contexto } = armar(
      { [REQUIERE_PERMISO]: REQUERIDO, [SOLO_AUTENTICADO]: true },
      { idRolUsuario: 4 },
      false,
    );
    await expect(guard.canActivate(contexto)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('una ruta sin ninguna marca se deniega y deja un error en el log', async () => {
    const { guard, contexto } = armar({}, { idRolUsuario: 4 });
    const error = jest
      .spyOn(guard['logger'], 'error')
      .mockImplementation(() => undefined);
    await expect(guard.canActivate(contexto)).rejects.toThrow(
      ForbiddenException,
    );
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('Controlador.ruta'),
    );
  });
});
