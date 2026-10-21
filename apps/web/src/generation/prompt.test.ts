import { createMaskMap, mask } from '@lavra/pii-br';
import { describe, expect, it } from 'vitest';
import { corporativa } from '../ata-types/corporativa';
import { REGRAS_COMUNS, REGRAS_TOM } from '../ata-types/regras-comuns';
import type { AtaDraft, Participante } from '../domain/draft';
import { STATUS_ENCAMINHAMENTO, TIPOS_BLOCO } from '../domain/draft';
import { criarRascunho } from '../domain/draft-reducer';
import { validarSchema } from '../ai/json-schema';
import type { JsonSchema } from '../ai/types';
import { schemaDaAta, schemaDaSecao } from './output-schema';
import { blocosParaTexto, montarPrompt, montarPromptSecao } from './prompt';

const CPF = '529.982.247-25';

function participante(id: string, parcial: Partial<Participante> = {}): Participante {
  return {
    id,
    nome: 'Ana Souza',
    papel: 'Diretora financeira',
    presenca: 'presente',
    justificativa: '',
    extras: {},
    ...parcial,
  };
}

function rascunho(parcial: Partial<AtaDraft> = {}): AtaDraft {
  return {
    ...criarRascunho(),
    dados: {
      organizacao: 'Cooperativa Fictícia Alfa',
      assunto: 'Planejamento do orçamento',
      data: '2026-10-14',
      inicio: '14:30',
      fim: '16:00',
      modalidade: 'presencial',
      local: 'Rua das Acácias, 100',
      conducao: 'Carla Mendes',
      redacao: 'Bruno Lima',
    },
    pauta: ['Orçamento de 2027', 'Contratação de auditoria'],
    participantes: [
      participante('p1'),
      participante('p2', { nome: 'Bruno Lima', papel: '', presenca: 'ausente' }),
      participante('p3', {
        nome: 'Davi Rocha',
        papel: 'Conselheiro',
        presenca: 'justificado',
        justificativa: 'Consulta médica no hospital Central',
      }),
    ],
    transcricao: `Ana: meu CPF é ${CPF}, anotem para o reembolso.`,
    ...parcial,
  };
}

function mascarar(d: AtaDraft): string {
  return mask(d.transcricao, { map: createMaskMap() }).masked;
}

describe('montarPrompt', () => {
  it('a mensagem leva a transcrição mascarada, nunca o CPF', () => {
    const d = rascunho();
    const { usuario } = montarPrompt(corporativa, d, mascarar(d));
    expect(usuario).toContain('[CPF_1]');
    expect(usuario).not.toContain(CPF);
    expect(usuario).not.toContain('52998224725');
  });

  it('leva pauta, participantes com papel e presença, data, modalidade e tom', () => {
    const d = rascunho({ tom: 'conciso' });
    const { usuario } = montarPrompt(corporativa, d, mascarar(d));
    expect(usuario).toContain('Reunião corporativa');
    expect(usuario).toContain('14/10/2026');
    expect(usuario).toContain('Presencial');
    expect(usuario).toContain('1. Orçamento de 2027');
    expect(usuario).toContain('2. Contratação de auditoria');
    expect(usuario).toContain('Ana Souza — Diretora financeira — presente');
    expect(usuario).toContain('Bruno Lima — ausente');
    expect(usuario).toContain('Davi Rocha — Conselheiro — ausência justificada');
    expect(usuario).toMatch(/Tom: conciso/);
  });

  it('não leva campos do formulário que não são metadados', () => {
    const d = rascunho();
    const { usuario, sistema } = montarPrompt(corporativa, d, mascarar(d));
    for (const texto of [
      'Cooperativa Fictícia Alfa',
      'Planejamento do orçamento',
      'Rua das Acácias',
      'Carla Mendes',
      '14h30',
      '16h',
      'Consulta médica',
    ]) {
      expect(usuario).not.toContain(texto);
      expect(sistema).not.toContain(texto);
    }
  });

  it('data vazia ou inválida não quebra a montagem', () => {
    const d = rascunho({ dados: { modalidade: 'remota', data: '' } });
    expect(montarPrompt(corporativa, d, 'x').usuario).toContain('Data: não informada');
    const d2 = rascunho({ dados: { data: '2026-02-31' } });
    expect(montarPrompt(corporativa, d2, 'x').usuario).toContain('Data: não informada');
    expect(montarPrompt(corporativa, d2, 'x').usuario).toContain('Modalidade: não informada');
  });

  it('o sistema traz as regras de não inventar, de marcadores, do tipo, do tom e das seções', () => {
    const d = rascunho({ tom: 'detalhado' });
    const { sistema } = montarPrompt(corporativa, d, mascarar(d));
    expect(sistema).toMatch(/secretári/);
    expect(sistema).toContain('Não invente.');
    expect(sistema).toContain('[PREENCHER: o que falta]');
    expect(sistema).toContain('A definir');
    expect(sistema).toMatch(/marcadores entre colchetes, como \[CPF_1\]/);
    expect(sistema).toMatch(/Não escreva títulos de seção, nem HTML, nem Markdown/);
    for (const regra of [...REGRAS_COMUNS, ...corporativa.regrasPrompt]) {
      expect(sistema).toContain(regra);
    }
    expect(sistema).toContain(REGRAS_TOM.detalhado);
    expect(sistema).not.toContain(REGRAS_TOM.conciso);
    for (const secao of corporativa.secoes) {
      expect(sistema).toContain(secao.instrucao);
      expect(sistema).toContain(`"${secao.chave}"`);
    }
    expect(sistema).toContain('pendente, em_andamento, concluido, cancelado');
  });
});

describe('montarPromptSecao', () => {
  it('pede só a seção, com o texto atual e a instrução mascarados', () => {
    const d = rascunho();
    const { sistema, usuario } = montarPromptSecao(
      corporativa,
      d,
      'decisoes',
      'Aprovado o reembolso para [CPF_1].',
      'Cite o [TELEFONE_1] de contato',
      mascarar(d),
    );
    expect(sistema).toContain('Decisões');
    expect(sistema).toContain(corporativa.secoes[2]?.instrucao);
    expect(sistema).not.toContain(corporativa.secoes[0]?.instrucao);
    expect(usuario).toContain('Aprovado o reembolso para [CPF_1].');
    expect(usuario).toContain('Cite o [TELEFONE_1] de contato');
    expect(usuario).toContain('[CPF_1], anotem');
    expect(usuario).not.toContain(CPF);
  });

  it('sem instrução, pede para reescrever a partir da transcrição', () => {
    const d = rascunho();
    const { usuario } = montarPromptSecao(corporativa, d, 'resumo', '', null, 'x');
    expect(usuario).toMatch(/Instrução da pessoa: nenhuma/);
    expect(usuario).toMatch(/Texto atual da seção: vazio/);
  });

  it('encaminhamentos também podem ser reescritos sozinhos', () => {
    const d = rascunho();
    const { sistema } = montarPromptSecao(corporativa, d, 'encaminhamentos', '', null, 'x');
    expect(sistema).toMatch(/Encaminhamentos/);
    expect(sistema).not.toContain(corporativa.secoes[0]?.instrucao);
  });

  it('chave desconhecida é erro de programação', () => {
    expect(() => montarPromptSecao(corporativa, rascunho(), 'nada', '', null, 'x')).toThrow();
  });
});

describe('blocosParaTexto', () => {
  it('parágrafos separados por linha em branco e itens com "- "', () => {
    expect(
      blocosParaTexto([
        { tipo: 'paragrafo', texto: 'Primeiro.', itens: [] },
        { tipo: 'lista', texto: '', itens: ['um', 'dois'] },
        { tipo: 'paragrafo', texto: 'Último.', itens: [] },
      ]),
    ).toBe('Primeiro.\n\n- um\n- dois\n\nÚltimo.');
  });
});

/** Confere a regra dos três provedores: object/array/string/enum, sem extras, tudo obrigatório. */
function conferirSubconjunto(s: JsonSchema): void {
  expect(['object', 'array', 'string']).toContain(s.type);
  if (s.type === 'object') {
    expect(s.additionalProperties).toBe(false);
    expect([...(s.required ?? [])].sort()).toEqual(Object.keys(s.properties ?? {}).sort());
    for (const filho of Object.values(s.properties ?? {})) conferirSubconjunto(filho);
  }
  if (s.type === 'array' && s.items) conferirSubconjunto(s.items);
}

describe('schemas', () => {
  it('schema da ata: uma lista de blocos por seção + encaminhamentos, no subconjunto comum', () => {
    const s = schemaDaAta(corporativa);
    conferirSubconjunto(s);
    expect(Object.keys(s.properties?.secoes?.properties ?? {})).toEqual(
      corporativa.secoes.map((x) => x.chave),
    );
    const bloco = s.properties?.secoes?.properties?.resumo?.items;
    expect(bloco?.properties?.tipo?.enum).toEqual([...TIPOS_BLOCO]);
    const enc = s.properties?.encaminhamentos?.items;
    expect(enc?.properties?.status?.enum).toEqual([...STATUS_ENCAMINHAMENTO]);
    expect(
      validarSchema(
        {
          secoes: Object.fromEntries(corporativa.secoes.map((x) => [x.chave, []])),
          encaminhamentos: [
            { acao: 'Enviar', responsavel: 'Ana', prazo: '2026-10-30', status: 'pendente' },
          ],
        },
        s,
      ),
    ).toEqual([]);
  });

  it('tipo sem encaminhamentos não pede a lista', () => {
    const s = schemaDaAta({ ...corporativa, temEncaminhamentos: false });
    expect(s.properties?.encaminhamentos).toBeUndefined();
    conferirSubconjunto(s);
  });

  it('schema da seção: só os blocos daquela seção (ou só os encaminhamentos)', () => {
    const s = schemaDaSecao(corporativa, 'riscos');
    conferirSubconjunto(s);
    expect(Object.keys(s.properties ?? {})).toEqual(['blocos']);
    const e = schemaDaSecao(corporativa, 'encaminhamentos');
    conferirSubconjunto(e);
    expect(Object.keys(e.properties ?? {})).toEqual(['encaminhamentos']);
    expect(() => schemaDaSecao(corporativa, 'nada')).toThrow();
    expect(() =>
      schemaDaSecao({ ...corporativa, temEncaminhamentos: false }, 'encaminhamentos'),
    ).toThrow();
  });
});
