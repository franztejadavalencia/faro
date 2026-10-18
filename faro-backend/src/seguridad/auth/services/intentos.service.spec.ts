import { Repository } from 'typeorm';
import { Usuario } from '../../entities/usuario.entity';
import { BitacoraService } from '../../services/bitacora.service';
import { estaBloqueado, IntentosService } from './intentos.service';

function armar() {
  const qb: Record<string, jest.Mock> = {};
  for (const metodo of ['update', 'set', 'where']) {
    qb[metodo] = jest.fn(() => qb);
  }
  qb.execute = jest.fn().mockResolvedValue({ raw: [] });
  const usuarios = {
    createQueryBuilder: jest.fn(() => qb),
  } as unknown as Repository<Usuario>;
  const servicio = new IntentosService(usuarios, {
    registrarAcceso: jest.fn(),
  } as unknown as BitacoraService);
  return { servicio, qb };
}

describe('IntentosService.reiniciar', () => {
  it('sin fallos ni bloqueo no escribe', async () => {
    const { servicio, qb } = armar();
    await servicio.reiniciar({
      idUsuario: 3,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    } as Usuario);
    expect(qb.execute).not.toHaveBeenCalled();
  });

  it('con fallos o un bloqueo vencido pone el contador en 0', async () => {
    const { servicio, qb } = armar();
    await servicio.reiniciar({
      idUsuario: 3,
      intentosFallidos: 2,
      bloqueadoHasta: null,
    } as Usuario);
    expect(qb.set).toHaveBeenCalledWith({
      intentosFallidos: 0,
      bloqueadoHasta: null,
    });
    expect(qb.where).toHaveBeenCalledWith('id_usuario = :id', { id: 3 });
  });
});

describe('estaBloqueado', () => {
  it('solo con bloqueado_hasta en el futuro (hora real)', () => {
    const con = (bloqueadoHasta: Date | null) =>
      estaBloqueado({ bloqueadoHasta } as Usuario);
    expect(con(null)).toBe(false);
    expect(con(new Date(Date.now() - 1000))).toBe(false);
    expect(con(new Date(Date.now() + 60_000))).toBe(true);
  });
});
