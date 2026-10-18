import { nombreCompleto } from './nombre-completo';

describe('nombreCompleto', () => {
  it('une nombre y apellidos', () => {
    expect(
      nombreCompleto({ nombre: 'Ana', paterno: 'Pérez', materno: 'Rojas' }),
    ).toBe('Ana Pérez Rojas');
  });

  it('omite los apellidos que faltan', () => {
    expect(
      nombreCompleto({ nombre: 'Ana', paterno: 'Pérez', materno: null }),
    ).toBe('Ana Pérez');
    expect(
      nombreCompleto({ nombre: 'Ana', paterno: null, materno: 'Rojas' }),
    ).toBe('Ana Rojas');
  });

  it('una razón social queda tal cual', () => {
    expect(
      nombreCompleto({
        nombre: 'Tienda Sol SRL',
        paterno: null,
        materno: null,
      }),
    ).toBe('Tienda Sol SRL');
  });

  it('ignora espacios y apellidos vacíos', () => {
    expect(
      nombreCompleto({ nombre: ' Ana ', paterno: '  ', materno: '' }),
    ).toBe('Ana');
  });
});
