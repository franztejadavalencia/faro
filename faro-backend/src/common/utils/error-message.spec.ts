import { getErrorMessage, getPgErrorCode } from './error-message';

describe('getPgErrorCode', () => {
  it('lee el código de driverError (QueryFailedError)', () => {
    expect(getPgErrorCode({ driverError: { code: '23505' } })).toBe('23505');
  });

  it('lee el código del propio error si no hay driverError', () => {
    expect(getPgErrorCode({ code: '23503' })).toBe('23503');
  });

  it('undefined si no hay código de texto', () => {
    expect(getPgErrorCode(new Error('x'))).toBeUndefined();
    expect(getPgErrorCode({ code: 23505 })).toBeUndefined();
    expect(getPgErrorCode(null)).toBeUndefined();
    expect(getPgErrorCode('23505')).toBeUndefined();
  });
});

describe('getErrorMessage', () => {
  it('usa el mensaje de un Error o convierte a texto', () => {
    expect(getErrorMessage(new Error('falló'))).toBe('falló');
    expect(getErrorMessage(42)).toBe('42');
  });
});
