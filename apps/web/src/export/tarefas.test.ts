import { describe, expect, it } from 'vitest';
import type { Encaminhamento, StatusEncaminhamento } from '../domain/draft';
import { agruparPorResponsavel, mensagemTarefasCopiadas, textoDasTarefas } from './tarefas';

function tarefa(
  responsavel: string,
  acao = 'Enviar relatório',
  prazo = '',
  status: StatusEncaminhamento = 'pendente',
): Encaminhamento {
  return { acao, responsavel, prazo, status };
}

describe('agruparPorResponsavel', () => {
  it('junta só espaço, caixa e NFC: "Joana Prado" e " joana  prado " são um grupo', () => {
    const grupos = agruparPorResponsavel([
      tarefa('Joana Prado', 'A'),
      tarefa(' joana  prado ', 'B'),
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.responsavel).toBe('Joana Prado');
    expect(grupos[0]?.semResponsavel).toBe(false);
    expect(grupos[0]?.itens.map((i) => i.acao)).toEqual(['A', 'B']);
  });

  it('junta a mesma grafia em NFC e NFD', () => {
    const grupos = agruparPorResponsavel([tarefa('José'), tarefa('José')]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.responsavel).toBe('José');
  });

  it('não remove acento: "José" e "Jose" ficam separados', () => {
    const grupos = agruparPorResponsavel([tarefa('José'), tarefa('Jose')]);
    expect(grupos.map((g) => g.responsavel).sort()).toEqual(['Jose', 'José']);
  });

  it('não adivinha: "Ana" e "Ana Souza" ficam separados', () => {
    const grupos = agruparPorResponsavel([tarefa('Ana'), tarefa('Ana Souza')]);
    expect(grupos.map((g) => g.responsavel)).toEqual(['Ana', 'Ana Souza']);
  });

  it('vazio, só espaço, "A definir" e "a definir" viram um grupo sem responsável, sempre por último', () => {
    const grupos = agruparPorResponsavel([
      tarefa(''),
      tarefa('Zélia'),
      tarefa('A definir'),
      tarefa('   '),
      tarefa('a  definir'),
    ]);
    expect(grupos.map((g) => g.responsavel)).toEqual(['Zélia', 'A definir']);
    expect(grupos[1]?.semResponsavel).toBe(true);
    expect(grupos[1]?.itens).toHaveLength(4);
    expect(grupos[0]?.semResponsavel).toBe(false);
  });

  it('ordena em pt-BR: "Álvaro" vem antes de "Bruno"', () => {
    const grupos = agruparPorResponsavel([tarefa('Bruno'), tarefa('Álvaro')]);
    expect(grupos.map((g) => g.responsavel)).toEqual(['Álvaro', 'Bruno']);
  });

  it('é determinístico: mesma entrada, mesma saída; grafias sem empate mantêm a ordem de aparição', () => {
    const entrada = [tarefa('Carla', '1'), tarefa('Ana', '2'), tarefa('carla', '3')];
    const a = agruparPorResponsavel(entrada);
    const b = agruparPorResponsavel(entrada);
    expect(a).toEqual(b);
    expect(a.map((g) => g.responsavel)).toEqual(['Ana', 'Carla']);
    expect(a[1]?.itens.map((i) => i.acao)).toEqual(['1', '3']);
  });

  it('lista vazia → nenhum grupo', () => {
    expect(agruparPorResponsavel([])).toEqual([]);
  });

  it('volume: 200 encaminhamentos de 50 responsáveis → 50 grupos de 4 itens', () => {
    const itens = Array.from({ length: 200 }, (_, i) =>
      tarefa(`Pessoa ${String(i % 50).padStart(2, '0')}`, `Ação ${String(i)}`),
    );
    const grupos = agruparPorResponsavel(itens);
    expect(grupos).toHaveLength(50);
    expect(grupos.every((g) => g.itens.length === 4)).toBe(true);
    expect(grupos[0]?.responsavel).toBe('Pessoa 00');
    expect(grupos[49]?.responsavel).toBe('Pessoa 49');
  });
});

describe('textoDasTarefas', () => {
  const itens = [
    tarefa('Bruno Lima', 'Revisar o contrato', '2026-10-30'),
    tarefa('Ana Souza', 'Convocar a reunião', 'próxima reunião', 'concluido'),
    tarefa('', 'Definir o orçamento', '', 'cancelado'),
  ];

  it('monta o texto exato, com prazo formatado, prazo livre mantido e status fora do pendente', () => {
    const { texto, pessoas, semResponsavel } = textoDasTarefas('Ata de Teste', '2026-10-21', itens);
    expect(texto).toBe(
      [
        'Ata de Teste',
        'Reunião de 21/10/2026',
        '',
        'Tarefas por responsável',
        '',
        'Ana Souza',
        '- Convocar a reunião (prazo: próxima reunião) — Concluído',
        '',
        'Bruno Lima',
        '- Revisar o contrato (prazo: 30/10/2026)',
        '',
        'A definir',
        '- Definir o orçamento — Cancelado',
      ].join('\n'),
    );
    expect(pessoas).toBe(2);
    expect(semResponsavel).toBe(1);
  });

  it('sem data válida omite a linha "Reunião de"', () => {
    for (const data of [undefined, '', '2026-02-30', 'ontem']) {
      const { texto } = textoDasTarefas('Ata', data, [tarefa('Ana')]);
      expect(texto).toBe('Ata\n\nTarefas por responsável\n\nAna\n- Enviar relatório');
    }
  });

  it('título vazio omite a linha do título', () => {
    const { texto } = textoDasTarefas('  ', undefined, [tarefa('Ana')]);
    expect(texto).toBe('Tarefas por responsável\n\nAna\n- Enviar relatório');
  });

  it('sem tarefas devolve só o cabeçalho e zeros', () => {
    const r = textoDasTarefas('Ata', undefined, []);
    expect(r).toEqual({ texto: 'Ata\n\nTarefas por responsável', pessoas: 0, semResponsavel: 0 });
  });

  it('sem linha final vazia e sem prazo quando vazio ou só espaço', () => {
    const { texto } = textoDasTarefas('Ata', undefined, [tarefa('Ana', 'Fazer', '   ')]);
    expect(texto.endsWith('\n')).toBe(false);
    expect(texto).not.toContain('prazo');
  });

  it('status em andamento aparece com o rótulo da ata', () => {
    const { texto } = textoDasTarefas('Ata', undefined, [
      tarefa('Ana', 'Fazer', '', 'em_andamento'),
    ]);
    expect(texto).toContain('- Fazer — Em andamento');
  });
});

describe('mensagemTarefasCopiadas', () => {
  it.each([
    [{ pessoas: 3, semResponsavel: 0 }, 'Tarefas de 3 pessoas copiadas.'],
    [{ pessoas: 1, semResponsavel: 0 }, 'Tarefas de 1 pessoa copiadas.'],
    [
      { pessoas: 1, semResponsavel: 2 },
      'Tarefas de 1 pessoa copiadas (2 sem responsável definido).',
    ],
    [
      { pessoas: 3, semResponsavel: 1 },
      'Tarefas de 3 pessoas copiadas (1 sem responsável definido).',
    ],
    [{ pessoas: 0, semResponsavel: 2 }, '2 tarefas sem responsável definido copiadas.'],
    [{ pessoas: 0, semResponsavel: 1 }, '1 tarefa sem responsável definido copiada.'],
    [{ pessoas: 0, semResponsavel: 0 }, 'Nenhuma tarefa para copiar.'],
  ])('%j → %s', (entrada, esperado) => {
    expect(mensagemTarefasCopiadas(entrada)).toBe(esperado);
  });
});
