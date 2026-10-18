import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource, QueryFailedError } from 'typeorm';
import {
  ContextoRequest,
  RequestContextService,
} from '../src/common/services/request-context.service';
import { RequestConUsuario } from '../src/common/types/payload-token';
import { Reloj } from '../src/common/reloj/reloj';
import { RelojFijo } from '../src/common/reloj/reloj-fijo';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { crearApp } from './utils/crear-app';
import { limpiarBase } from './utils/limpiar-base';

/**
 * Solo de prueba: hace de guard JWT (B4) con cabeceras, para comprobar que el
 * interceptor de `common/` deja el contexto visible en el handler y en los
 * servicios, también después de un `await`.
 */
@Injectable()
class GuardDePrueba implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestConUsuario>();
    const usuario = request.headers['x-prueba-usuario'];
    if (typeof usuario === 'string') {
      const negocio = request.headers['x-prueba-negocio'];
      request.usuarioActual = {
        idUsuario: Number(usuario),
        idNegocio: typeof negocio === 'string' ? Number(negocio) : null,
      };
    }
    return true;
  }
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
class ServicioDePrueba {
  constructor(private readonly contexto: RequestContextService) {}

  async leer(ms: number): Promise<ContextoRequest | undefined> {
    await pausa(ms);
    return this.contexto.obtenerContexto();
  }
}

@Controller('prueba')
class ControladorDePrueba {
  constructor(
    private readonly servicio: ServicioDePrueba,
    private readonly reloj: Reloj,
  ) {}

  @Get('contexto')
  contexto(@Query('ms') ms = '0') {
    return this.servicio.leer(Number(ms));
  }

  @Get('hoy')
  hoy() {
    return { hoy: this.reloj.hoy() };
  }

  @Get('no-encontrado')
  noEncontrado() {
    throw new NotFoundException('No existe');
  }

  @Get('error')
  error() {
    throw new Error('detalle interno que no debe salir');
  }

  @Get('unico')
  unico() {
    throw new QueryFailedError(
      'INSERT …',
      [],
      Object.assign(new Error('duplicate key'), {
        code: '23505',
        constraint: 'uq_secreta',
      }),
    );
  }
}

@Module({
  controllers: [ControladorDePrueba],
  providers: [
    ServicioDePrueba,
    { provide: APP_GUARD, useClass: GuardDePrueba },
  ],
})
class ModuloDePrueba {}

describe('Contexto del request, reloj y filtro de errores (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await crearApp([ModuloDePrueba]);
    await limpiarBase(app.get(DataSource));
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('contexto (AsyncLocalStorage)', () => {
    it('el handler y el servicio, tras un await, ven usuario, negocio, ip, url y método', async () => {
      const { body } = await http()
        .get('/api/prueba/contexto?ms=20')
        .set('x-prueba-usuario', '5')
        .set('x-prueba-negocio', '7')
        .expect(200);
      expect(body).toMatchObject({
        idUsuario: 5,
        idNegocio: 7,
        url: '/api/prueba/contexto?ms=20',
        metodo: 'GET',
      });
      expect(typeof body.ip).toBe('string');
    });

    it('usuario de plataforma: idNegocio null', async () => {
      const { body } = await http()
        .get('/api/prueba/contexto')
        .set('x-prueba-usuario', '1')
        .expect(200);
      expect(body.idUsuario).toBe(1);
      expect(body.idNegocio).toBeNull();
    });

    it('sin sesión: contexto sin usuario ni negocio', async () => {
      const { body } = await http().get('/api/prueba/contexto').expect(200);
      expect(body.idUsuario).toBeUndefined();
      expect(body.idNegocio).toBeUndefined();
    });

    it('peticiones simultáneas no se mezclan', async () => {
      const respuestas = await Promise.all(
        [1, 2, 3, 4, 5, 6].map((id) =>
          http()
            .get(`/api/prueba/contexto?ms=${(7 - id) * 15}`)
            .set('x-prueba-usuario', String(id))
            .set('x-prueba-negocio', String(id * 10)),
        ),
      );
      expect(
        respuestas.map((r) => [r.body.idUsuario, r.body.idNegocio]),
      ).toEqual([1, 2, 3, 4, 5, 6].map((id) => [id, id * 10]));
    });
  });

  describe('Reloj', () => {
    it('por defecto es el reloj del sistema (formato AAAA-MM-DD)', async () => {
      const { body } = await http().get('/api/prueba/hoy').expect(200);
      expect(body.hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('se sustituye por código con overrideProvider', async () => {
      const otraApp = await crearAppConRelojFijo();
      try {
        const { body } = await request(otraApp.getHttpServer())
          .get('/api/prueba/hoy')
          .expect(200);
        expect(body.hoy).toBe('2026-05-15');
      } finally {
        await otraApp.close();
      }
    });
  });

  describe('filtro global', () => {
    it('HttpException tal cual', async () => {
      const { body } = await http()
        .get('/api/prueba/no-encontrado')
        .expect(404);
      expect(body).toEqual({
        statusCode: 404,
        message: 'No existe',
        error: 'Not Found',
      });
    });

    it('23505 → 409 sin detalles de la base', async () => {
      const { body } = await http().get('/api/prueba/unico').expect(409);
      expect(body.message).toBe('Ya existe un registro con esos datos.');
      expect(JSON.stringify(body)).not.toMatch(/uq_secreta|duplicate/);
    });

    it('un Error cualquiera → 500 genérico (el detalle va al log)', async () => {
      const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const { body } = await http().get('/api/prueba/error').expect(500);
      expect(log).toHaveBeenCalledWith(
        'detalle interno que no debe salir',
        expect.any(String),
      );
      log.mockRestore();
      expect(body).toEqual({
        statusCode: 500,
        message: 'Error interno del servidor',
        error: 'Internal Server Error',
      });
    });

    it('una ruta que no existe sigue siendo 404', async () => {
      await http().get('/api/no-existe').expect(404);
    });
  });
});

async function crearAppConRelojFijo(): Promise<NestExpressApplication> {
  const modulo = await Test.createTestingModule({
    imports: [AppModule, ModuloDePrueba],
  })
    .overrideProvider(Reloj)
    .useValue(new RelojFijo('2026-05-15'))
    .compile();
  const app = modulo.createNestApplication<NestExpressApplication>();
  configurarApp(app);
  await app.init();
  return app;
}
