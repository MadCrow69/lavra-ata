import { describe, expect, it } from 'vitest';
import {
  CAMPO_DATA,
  CAMPO_FIM,
  CAMPO_INICIO,
  VALORES_MODALIDADE,
  cabecalhoDaReuniao,
  campoModalidade,
  campoTexto,
  sufixoHora,
} from './campos-comuns';
import type { CampoDef } from './types';

describe('campoModalidade', () => {
  it('só traz as opções com rótulo, na ordem de VALORES_MODALIDADE', () => {
    const campo = campoModalidade({ hibrida: 'H', presencial: 'P' });
    expect(campo.id).toBe('modalidade');
    expect(campo.tipo).toBe('escolha');
    expect(campo.obrigatorio).toBe(true);
    expect(campo.opcoes).toEqual([
      { valor: 'presencial', rotulo: 'P' },
      { valor: 'hibrida', rotulo: 'H' },
    ]);
    expect(campo.ajuda).toBeUndefined();
  });

  it('aceita a ajuda e cobre os três valores', () => {
    const campo = campoModalidade({ presencial: 'P', remota: 'R', hibrida: 'H' }, 'Como foi.');
    expect(campo.opcoes?.map((o) => o.valor)).toEqual([...VALORES_MODALIDADE]);
    expect(campo.ajuda).toBe('Como foi.');
  });
});

describe('campos de data e horário', () => {
  it('têm id, tipo e obrigatoriedade fixos', () => {
    expect([CAMPO_DATA, CAMPO_INICIO, CAMPO_FIM].map((c) => [c.id, c.tipo, c.obrigatorio])).toEqual(
      [
        ['data', 'data', true],
        ['inicio', 'hora', true],
        ['fim', 'hora', false],
      ],
    );
  });

  it('não podem ser alterados por quem os usa (são compartilhados entre tipos)', () => {
    expect(Object.isFrozen(CAMPO_DATA)).toBe(true);
    expect(Object.isFrozen(CAMPO_INICIO)).toBe(true);
    expect(Object.isFrozen(CAMPO_FIM)).toBe(true);
  });
});

describe('campoTexto', () => {
  it('cria um campo de texto opcional e aceita sobrescritas', () => {
    expect(campoTexto('presidente', 'Presidente')).toEqual({
      id: 'presidente',
      rotulo: 'Presidente',
      tipo: 'texto',
      obrigatorio: false,
    });
    const local = campoTexto('local', 'Local', { obrigatorio: true, ajuda: 'Endereço.' });
    expect(local).toMatchObject({
      id: 'local',
      tipo: 'texto',
      obrigatorio: true,
      ajuda: 'Endereço.',
    });
  });
});

describe('sufixoHora', () => {
  it('formata o término informado', () => {
    expect(sufixoHora('16:00')).toBe(' às 16h');
    expect(sufixoHora('16:30')).toBe(' às 16h30');
  });

  it('vazio, ausente ou inválido → sem sufixo', () => {
    expect(sufixoHora('')).toBe('');
    expect(sufixoHora(undefined)).toBe('');
    expect(sufixoHora('25:99')).toBe('');
  });
});

describe('cabecalhoDaReuniao', () => {
  const CAMPOS: CampoDef[] = [
    CAMPO_DATA,
    CAMPO_INICIO,
    CAMPO_FIM,
    campoModalidade({ presencial: 'Presencial', remota: 'Remota', hibrida: 'Híbrida' }),
    campoTexto('local', 'Local', { visivelSe: (d) => d.modalidade !== 'remota' }),
    campoTexto('plataforma', 'Plataforma', { visivelSe: (d) => d.modalidade !== 'presencial' }),
  ];

  it('imprime data, horário, modalidade, local e plataforma informados e visíveis', () => {
    expect(
      cabecalhoDaReuniao(
        {
          data: '2026-10-14',
          inicio: '14:30',
          fim: '16:00',
          modalidade: 'hibrida',
          local: 'Sala 2',
          plataforma: 'Videoconferência',
        },
        CAMPOS,
      ),
    ).toEqual([
      'Data: 14/10/2026',
      'Horário: 14h30 às 16h',
      'Modalidade: Híbrida',
      'Local: Sala 2',
      'Plataforma: Videoconferência',
    ]);
  });

  it('omite o campo invisível mesmo preenchido, e o visível vazio', () => {
    const presencial = cabecalhoDaReuniao(
      { modalidade: 'presencial', local: 'Sala 2', plataforma: 'Videoconferência' },
      CAMPOS,
    );
    expect(presencial).toEqual(['Modalidade: Presencial', 'Local: Sala 2']);
    const remota = cabecalhoDaReuniao(
      { modalidade: 'remota', local: 'Sala 2', plataforma: '  ' },
      CAMPOS,
    );
    expect(remota).toEqual(['Modalidade: Remota']);
  });

  it('só o término vira "Término"; datas e horas inválidas e opção desconhecida somem', () => {
    expect(cabecalhoDaReuniao({ fim: '16:00' }, CAMPOS)).toEqual(['Término: 16h']);
    expect(
      cabecalhoDaReuniao({ data: '2026-02-30', inicio: '25:00', modalidade: 'online' }, CAMPOS),
    ).toEqual([]);
  });

  it('ignora valores de campos que o tipo não declara (vindos de outro tipo)', () => {
    expect(
      cabecalhoDaReuniao({ data: '2026-10-14', local: 'Sala 2', plataforma: 'Videoconferência' }, [
        CAMPO_DATA,
      ]),
    ).toEqual(['Data: 14/10/2026']);
  });

  it('usa o rótulo dinâmico do campo (rotuloPor)', () => {
    const local = campoTexto('local', 'Local', {
      rotuloPor: (d) => (d.modalidade === 'remota' ? 'Plataforma' : 'Local'),
    });
    expect(
      cabecalhoDaReuniao({ modalidade: 'remota', local: 'Videoconferência' }, [
        campoModalidade({ remota: 'Remota' }),
        local,
      ]),
    ).toEqual(['Modalidade: Remota', 'Plataforma: Videoconferência']);
  });
});
