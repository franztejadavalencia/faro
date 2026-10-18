import {
  Entorno,
  origenesCors,
  swaggerHabilitado,
  validarEntorno,
  valorTrustProxy,
} from './env.validation';

const base: Record<string, unknown> = {
  PORT: '3000',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_NAME: 'faro_test',
  DB_USER: 'postgres',
  DB_PASSWORD: 'x',
  JWT_SECRET: 'x',
  CORS_ORIGIN: 'http://localhost:4200',
};

describe('validarEntorno', () => {
  it('acepta un .env válido, convierte puertos a número y usa development por defecto', () => {
    const variables = validarEntorno(base);
    expect(variables.PORT).toBe(3000);
    expect(variables.DB_PORT).toBe(5432);
    expect(variables.NODE_ENV).toBe(Entorno.Desarrollo);
  });

  it('falla y nombra la variable que falta', () => {
    const sinJwt = { ...base };
    delete sinJwt.JWT_SECRET;
    expect(() => validarEntorno(sinJwt)).toThrow(/JWT_SECRET/);
  });

  it('las variables ADMIN_* son opcionales y se conservan si están', () => {
    expect(validarEntorno(base).ADMIN_CLAVE).toBeUndefined();
    const variables = validarEntorno({
      ...base,
      ADMIN_USUARIO: 'admin',
      ADMIN_CLAVE: 'una-clave-larga',
      ADMIN_NOMBRE: 'Administrador',
    });
    expect(variables.ADMIN_USUARIO).toBe('admin');
    expect(variables.ADMIN_CLAVE).toBe('una-clave-larga');
    expect(variables.ADMIN_NOMBRE).toBe('Administrador');
  });

  it('rechaza un NODE_ENV desconocido', () => {
    expect(() => validarEntorno({ ...base, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });

  it('acepta TRUST_PROXY vacío, un número o loopback', () => {
    for (const valor of ['', '1', 'loopback', '10.0.0.0/8']) {
      expect(() =>
        validarEntorno({ ...base, TRUST_PROXY: valor }),
      ).not.toThrow();
    }
  });

  it('rechaza TRUST_PROXY=true y explica por qué', () => {
    expect(() => validarEntorno({ ...base, TRUST_PROXY: 'true' })).toThrow(
      /TRUST_PROXY no acepta true/,
    );
    expect(() => validarEntorno({ ...base, TRUST_PROXY: 'TRUE' })).toThrow(
      /TRUST_PROXY no acepta true/,
    );
  });

  it('rechaza TRUST_PROXY=false', () => {
    expect(() => validarEntorno({ ...base, TRUST_PROXY: 'false' })).toThrow(
      /TRUST_PROXY no acepta false/,
    );
  });

  it('rechaza un SWAGGER que no sea true o false', () => {
    expect(() => validarEntorno({ ...base, SWAGGER: 'si' })).toThrow(/SWAGGER/);
  });
});

describe('valorTrustProxy', () => {
  it('vacío o ausente = sin proxy', () => {
    expect(valorTrustProxy(undefined)).toBeNull();
    expect(valorTrustProxy('  ')).toBeNull();
  });

  it('un número pasa como number y el resto como string', () => {
    expect(valorTrustProxy('1')).toBe(1);
    expect(valorTrustProxy('loopback')).toBe('loopback');
  });
});

describe('swaggerHabilitado', () => {
  it('activo en development y test', () => {
    expect(swaggerHabilitado(Entorno.Desarrollo, undefined)).toBe(true);
    expect(swaggerHabilitado(Entorno.Prueba, '')).toBe(true);
  });

  it('en production solo con SWAGGER=true', () => {
    expect(swaggerHabilitado(Entorno.Produccion, undefined)).toBe(false);
    expect(swaggerHabilitado(Entorno.Produccion, 'false')).toBe(false);
    expect(swaggerHabilitado(Entorno.Produccion, 'true')).toBe(true);
  });
});

describe('origenesCors', () => {
  it('separa por coma y quita espacios', () => {
    expect(
      origenesCors('http://localhost:4200, https://faro.example.com'),
    ).toEqual(['http://localhost:4200', 'https://faro.example.com']);
  });
});
