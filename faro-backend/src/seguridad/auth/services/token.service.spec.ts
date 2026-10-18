import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';

const SECRETO = 'secreto-de-prueba-de-al-menos-32-caracteres';

describe('TokenService', () => {
  const jwt = new JwtService({
    secret: SECRETO,
    signOptions: { expiresIn: '12h', algorithm: 'HS256' },
  });
  const tokens = new TokenService(jwt);
  const payload = { idUsuario: 3, idNegocio: 7, versionSesion: 2 };

  it('firma y verifica el payload de sesión', () => {
    expect(tokens.verificar(tokens.firmar(payload))).toEqual(payload);
  });

  it('admite idNegocio null (admin de plataforma)', () => {
    const plataforma = { ...payload, idNegocio: null };
    expect(tokens.verificar(tokens.firmar(plataforma))).toEqual(plataforma);
  });

  it('firma solo los campos del payload', () => {
    const conExtra = { ...payload, rol: 'Dueño' } as typeof payload;
    const decodificado = jwt.decode<Record<string, unknown>>(
      tokens.firmar(conExtra),
    );
    expect(Object.keys(decodificado).sort()).toEqual(
      ['exp', 'iat', 'idNegocio', 'idUsuario', 'versionSesion'].sort(),
    );
  });

  it('rechaza un token vencido', () => {
    const vencido = jwt.sign(payload, { expiresIn: -10 });
    expect(tokens.verificar(vencido)).toBeNull();
  });

  it('rechaza otra firma y basura', () => {
    const otro = new JwtService({
      secret: 'otro-secreto-distinto-de-32-caracteres',
    });
    expect(tokens.verificar(otro.sign(payload))).toBeNull();
    expect(tokens.verificar('no-es-un-jwt')).toBeNull();
  });

  it('rechaza un algoritmo distinto de HS256 (RFC 8725 §3.1)', () => {
    const hs512 = jwt.sign(payload, { algorithm: 'HS512' });
    expect(tokens.verificar(hs512)).toBeNull();
  });

  it('rechaza el token temporal de 2FA (con proposito)', () => {
    expect(
      tokens.verificar(jwt.sign({ ...payload, proposito: '2fa' })),
    ).toBeNull();
  });

  it.each([
    ['sin idUsuario', { idNegocio: 7, versionSesion: 0 }],
    ['sin versionSesion', { idUsuario: 3, idNegocio: 7 }],
    ['idUsuario no entero', { idUsuario: '3', idNegocio: 7, versionSesion: 0 }],
    ['idNegocio indefinido', { idUsuario: 3, versionSesion: 0 }],
  ])('rechaza un payload incompleto: %s', (_texto, incompleto) => {
    expect(tokens.verificar(jwt.sign(incompleto))).toBeNull();
  });

  describe('token temporal de la 2FA', () => {
    const temporal = { idUsuario: 3, versionSesion: 2 };

    it('firma y verifica, con proposito 2fa y 5 min de vigencia', () => {
      const token = tokens.firmarTemporal(temporal);
      expect(tokens.verificarTemporal(token)).toEqual(temporal);
      const decodificado = jwt.decode<Record<string, number | string>>(token);
      expect(decodificado.proposito).toBe('2fa');
      expect(Number(decodificado.exp) - Number(decodificado.iat)).toBe(300);
      expect(decodificado).not.toHaveProperty('idNegocio');
    });

    it('no sirve como sesión, y el de sesión no sirve como temporal', () => {
      expect(tokens.verificar(tokens.firmarTemporal(temporal))).toBeNull();
      expect(tokens.verificarTemporal(tokens.firmar(payload))).toBeNull();
    });

    it('rechaza otro propósito, vencido, otra firma o payload incompleto', () => {
      expect(
        tokens.verificarTemporal(jwt.sign({ ...temporal, proposito: 'otro' })),
      ).toBeNull();
      expect(
        tokens.verificarTemporal(
          jwt.sign({ ...temporal, proposito: '2fa' }, { expiresIn: -10 }),
        ),
      ).toBeNull();
      const otro = new JwtService({
        secret: 'otro-secreto-distinto-de-32-caracteres',
      });
      expect(
        tokens.verificarTemporal(otro.sign({ ...temporal, proposito: '2fa' })),
      ).toBeNull();
      expect(
        tokens.verificarTemporal(jwt.sign({ idUsuario: 3, proposito: '2fa' })),
      ).toBeNull();
    });
  });
});
