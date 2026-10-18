import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryModule, DiscoveryService, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { readdirSync } from 'fs';
import { join } from 'path';
import { ES_PUBLICO } from '@common/decorators/publico.decorator';
import { REQUIERE_PERMISO } from '@seguridad/permiso/decorators/requiere-permiso.decorator';
import { SOLO_AUTENTICADO } from '@seguridad/permiso/decorators/solo-autenticado.decorator';

type Clase = new (...args: never[]) => object;

/** Todo `*.controller.ts` de `src/`, sin listarlos a mano: uno nuevo entra solo. */
function controladores(): Clase[] {
  const archivos = (
    readdirSync(__dirname, { recursive: true }) as string[]
  ).filter((a) => a.endsWith('.controller.ts'));
  const clases: Clase[] = [];
  for (const archivo of archivos) {
    // Carga dinámica: la prueba descubre los controladores, no los importa uno a uno.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const modulo = require(join(__dirname, archivo)) as Record<string, unknown>;
    for (const exportado of Object.values(modulo)) {
      if (
        typeof exportado === 'function' &&
        Reflect.hasMetadata(PATH_METADATA, exportado)
      ) {
        clases.push(exportado as Clase);
      }
    }
  }
  return clases;
}

/**
 * Denegar por defecto, en CI (decisión 99): toda ruta debe declarar
 * `@Publico()`, `@SoloAutenticado()` o `@RequierePermiso()`. `PermisoGuard`
 * ya responde 403 a una ruta sin marca, pero eso lo descubriría un usuario;
 * esta prueba lo descubre al correr `npm test`.
 */
describe('Rutas con permiso declarado', () => {
  it('ningún controlador tiene una ruta sin @Publico, @SoloAutenticado ni @RequierePermiso', async () => {
    const clases = controladores();
    expect(clases.length).toBeGreaterThan(0);

    const modulo = await Test.createTestingModule({
      imports: [DiscoveryModule],
      controllers: clases,
    })
      // Los servicios no se usan: solo se leen los metadatos de las rutas.
      .useMocker(() => ({}))
      .compile();
    const descubrimiento = modulo.get(DiscoveryService);
    const reflector = modulo.get(Reflector);

    const sinMarca: string[] = [];
    let rutas = 0;
    for (const { instance, metatype } of descubrimiento.getControllers()) {
      if (!instance || !metatype) continue;
      const prototipo = Object.getPrototypeOf(instance) as Record<
        string,
        unknown
      >;
      for (const nombre of Object.getOwnPropertyNames(prototipo)) {
        const manejador = prototipo[nombre];
        if (
          typeof manejador !== 'function' ||
          Reflect.getMetadata(METHOD_METADATA, manejador) === undefined
        ) {
          continue; // el constructor u otro método que no es una ruta
        }
        rutas += 1;
        const marcada = [ES_PUBLICO, SOLO_AUTENTICADO, REQUIERE_PERMISO].some(
          (clave) =>
            reflector.getAllAndOverride(clave, [manejador, metatype]) !==
            undefined,
        );
        if (!marcada) sinMarca.push(`${metatype.name}.${nombre}`);
      }
    }

    expect(rutas).toBeGreaterThan(0);
    expect(sinMarca).toEqual([]);
  });
});
