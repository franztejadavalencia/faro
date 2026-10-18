import { BadRequestException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { NegocioRepositoryFactory } from '@common/utils/negocio-repository.factory';
import { Persona } from '../../entities/persona.entity';
import { escaparLike, PersonaService } from './persona.service';

describe('escaparLike', () => {
  it('escapa %, _ y \\ para que sean literales en un ILIKE', () => {
    expect(escaparLike('100%')).toBe('100\\%');
    expect(escaparLike('a_b')).toBe('a\\_b');
    expect(escaparLike('a\\b')).toBe('a\\\\b');
  });

  it('deja intacto el texto normal', () => {
    expect(escaparLike('Ana Pérez 123')).toBe('Ana Pérez 123');
  });
});

function armar(repetida = false) {
  const save = jest.fn(async (p: Partial<Persona>) => ({ idPersona: 9, ...p }));
  const repositorio = {
    create: (datos: Partial<Persona>) => datos,
    save,
  } as unknown as Repository<Persona>;
  const exists = jest.fn().mockResolvedValue(repetida);
  const negocios = {
    para: jest.fn(() => ({ exists })),
  } as unknown as NegocioRepositoryFactory;
  return { save, exists, servicio: new PersonaService(negocios, repositorio) };
}

describe('PersonaService.crear', () => {
  it('crea una persona NATURAL con los campos vacíos en null', async () => {
    const { servicio, save } = armar();
    await servicio.crear({ nombre: 'Ana' });
    expect(save).toHaveBeenCalledWith({
      tipo: 'NATURAL',
      nombre: 'Ana',
      paterno: null,
      materno: null,
      tipoDocumento: null,
      documento: null,
      correo: null,
      telefono: null,
    });
  });

  it('el tipo de documento y el documento van juntos', async () => {
    const { servicio } = armar();
    await expect(
      servicio.crear({ nombre: 'Ana', documento: '123' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      servicio.crear({ nombre: 'Ana', tipoDocumento: 'CI' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('un documento repetido en el negocio es 409 y no guarda', async () => {
    const { servicio, save } = armar(true);
    await expect(
      servicio.crear({ nombre: 'Ana', tipoDocumento: 'CI', documento: '123' }),
    ).rejects.toThrow(ConflictException);
    expect(save).not.toHaveBeenCalled();
  });
});

describe('PersonaService.actualizarContacto', () => {
  const persona = () =>
    ({
      nombre: 'Ana',
      paterno: 'Pérez',
      materno: null,
      correo: 'a@x.bo',
      telefono: null,
    }) as Persona;

  it('cambia solo lo que viene y vacía un campo con cadena vacía', async () => {
    const { servicio } = armar();
    const resultado = await servicio.actualizarContacto(persona(), {
      telefono: '70000000',
      correo: '',
    });
    expect(resultado).toMatchObject({
      nombre: 'Ana',
      paterno: 'Pérez',
      correo: null,
      telefono: '70000000',
    });
  });

  it('el nombre no puede quedar vacío', async () => {
    const { servicio } = armar();
    await expect(
      servicio.actualizarContacto(persona(), { nombre: '  ' }),
    ).rejects.toThrow(BadRequestException);
  });
});
