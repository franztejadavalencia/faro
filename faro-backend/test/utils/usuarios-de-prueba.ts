import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { Negocio } from '../../src/plataforma/entities/negocio.entity';
import {
  ROL_DUENO,
  ROL_EMPLEADO,
} from '../../src/seguridad/permiso/constants/catalogo';
import { RolUsuario } from '../../src/seguridad/permiso/entities/rol-usuario.entity';
import {
  asegurarRolPlataforma,
  crearRolesIniciales,
} from '../../src/seguridad/permiso/utils/roles-iniciales';
import { Persona } from '../../src/seguridad/entities/persona.entity';
import { Usuario } from '../../src/seguridad/entities/usuario.entity';
import { hashearClave } from '../../src/seguridad/utils/clave';

export interface UsuarioDePrueba {
  idUsuario: number;
  idNegocio: number | null;
  usuario: string;
  /** La clave en claro, generada aquí: nunca una fija en el código. */
  clave: string;
  idRolUsuario: number;
}

/** Rol de un usuario de negocio: el fijo o el de empleado de `crearRolesIniciales`. */
export type RolDePrueba = 'DUENO' | 'EMPLEADO';

/**
 * Id del rol de un negocio por su nombre, creando Dueño y Empleado la primera
 * vez (`crearRolesIniciales`, lo mismo que hará el registro de D2).
 */
export async function rolDeNegocio(
  dataSource: DataSource,
  idNegocio: number,
  rol: RolDePrueba,
): Promise<number> {
  const nombre = rol === 'DUENO' ? ROL_DUENO : ROL_EMPLEADO;
  const buscar = () =>
    dataSource.getRepository(RolUsuario).findOneBy({ idNegocio, nombre });
  const existente = await buscar();
  if (existente) return existente.idRolUsuario;
  await dataSource.transaction((manager) =>
    crearRolesIniciales(manager, idNegocio),
  );
  return (await buscar())!.idRolUsuario;
}

let secuencia = 0;

/** Clave aleatoria que cumple `errorDeClave()`. */
export const claveAleatoria = (): string => randomBytes(12).toString('hex');

export async function crearNegocioDePrueba(
  dataSource: DataSource,
  nombre: string,
): Promise<Negocio> {
  const negocios = dataSource.getRepository(Negocio);
  return negocios.save(negocios.create({ nombre }));
}

/**
 * Persona y usuario guardados directo en `faro_test` (las altas por API llegan
 * con B7). Fuera de un request no hay contexto: el `idNegocio` es el dado.
 */
export async function crearUsuarioDePrueba(
  dataSource: DataSource,
  opciones: {
    negocio?: Negocio | null;
    /** Por defecto, el Dueño (o el rol de plataforma si no hay negocio). */
    rol?: RolDePrueba;
    debeCambiarClave?: boolean;
    nombre?: string;
  } = {},
): Promise<UsuarioDePrueba> {
  secuencia += 1;
  const idNegocio = opciones.negocio?.idNegocio ?? null;
  const usuario = `usuario${secuencia}_${randomBytes(3).toString('hex')}`;
  const clave = claveAleatoria();
  const idRolUsuario =
    idNegocio === null
      ? await asegurarRolPlataforma(dataSource.manager)
      : await rolDeNegocio(dataSource, idNegocio, opciones.rol ?? 'DUENO');

  const persona = await dataSource.getRepository(Persona).save(
    dataSource.getRepository(Persona).create({
      idNegocio,
      tipo: 'NATURAL',
      nombre: opciones.nombre ?? `Persona ${secuencia}`,
      paterno: 'Prueba',
      materno: null,
      tipoDocumento: null,
      documento: null,
      correo: null,
      telefono: null,
    }),
  );
  const fila = await dataSource.getRepository(Usuario).save(
    dataSource.getRepository(Usuario).create({
      idNegocio,
      usuario,
      clave: await hashearClave(clave),
      idPersona: persona.idPersona,
      idRolUsuario,
      debeCambiarClave: opciones.debeCambiarClave ?? false,
    }),
  );
  return { idUsuario: fila.idUsuario, idNegocio, usuario, clave, idRolUsuario };
}
