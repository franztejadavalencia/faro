import { Persona } from '../entities/persona.entity';

/**
 * Nombre para mostrar de una persona (`architecture.md` §7). Un solo helper en
 * lugar de un `CONCAT` repetido en cada consulta.
 */
export function nombreCompleto(
  persona: Pick<Persona, 'nombre' | 'paterno' | 'materno'>,
): string {
  return [persona.nombre, persona.paterno, persona.materno]
    .map((parte) => parte?.trim())
    .filter((parte): parte is string => !!parte)
    .join(' ');
}
