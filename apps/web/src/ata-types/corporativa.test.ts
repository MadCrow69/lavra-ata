import { describe, expect, it } from 'vitest';
import { LIMITE_TRANSCRICAO } from '../config/limits';
import { CHAVE_AVISOS_GERAIS, CHAVE_ENCAMINHAMENTOS, criarRascunho } from '../domain/draft-reducer';
import type { AtaDraft, Participante } from '../domain/draft';
import { corporativa } from './corporativa';
import { REGRAS_COMUNS } from './regras-comuns';
import {
  ATA_TYPES,
  TIPO_PADRAO_ID,
  camposFaltando,
  ehObrigatorio,
  obterTipo,
  rotuloDoCampo,
  transcricaoExcedeLimite,
} from './registry';
import type { AtaTypeDefinition } from './types';

function participante(parcial: Partial<Participante> = {}): Participante {
  return {
    id: 'p1',
    nome: 'Ana Souza',
    papel: 'Diretora',
    presenca: 'presente',
    justificativa: '',
    extras: {},
    ...parcial,
  };
}

function completo(sobrescrever: Partial<AtaDraft> = {}): AtaDraft {
  return {
    ...criarRascunho(),
    dados: {
      organizacao: 'Empresa Exemplo Ltda.',
      assunto: 'Planejamento trimestral',
      data: '2026-10-14',
      inicio: '14:30',
      fim: '16:00',
      modalidade: 'remota',
      conducao: 'Ana Souza',
      redacao: 'Bruno Lima',
    },
    pauta: ['Metas do trimestre'],
    participantes: [participante()],
    transcricao: 'Ana: bom dia a todos.',
    ...sobrescrever,
  };
}

describe('registro de tipos', () => {
  it('registra a corporativa (o tipo padrão, primeira da lista) antes dos tipos formais', () => {
    expect(Object.keys(ATA_TYPES)[0]).toBe('corporativa');
    expect(TIPO_PADRAO_ID).toBe('corporativa');
    expect(corporativa.id).toBe(TIPO_PADRAO_ID);
  });

  it('rótulos de bloco e papel próprios da corporativa', () => {
    expect(corporativa.rotulos).toEqual({
      participantes: 'Participantes',
      pauta: 'Pauta',
      pessoa: { singular: 'participante', plural: 'participantes' },
    });
    expect(corporativa.complementoIdentifica).toBe(true);
    expect(corporativa.rotuloPapel).toBe('Cargo / empresa');
  });

  it('obterTipo devolve o tipo pedido e cai no padrão se o id for desconhecido', () => {
    expect(obterTipo('corporativa')).toBe(corporativa);
    expect(obterTipo('inexistente')).toBe(corporativa);
  });

  it('declara as seções da ata corporativa, na ordem, e encaminhamentos', () => {
    expect(corporativa.secoes.map((s) => s.chave)).toEqual([
      'resumo',
      'discussao',
      'decisoes',
      'pendencias',
      'riscos',
      'proxima_reuniao',
    ]);
    expect(corporativa.temEncaminhamentos).toBe(true);
    for (const s of corporativa.secoes) {
      expect(s.titulo).not.toBe('');
      expect(s.instrucao).not.toBe('');
    }
  });

  it('usa "Cargo / empresa" como papel do participante', () => {
    expect(corporativa.rotuloPapel).toBe('Cargo / empresa');
    expect(corporativa.camposParticipante).toEqual([]);
  });

  it('ids de campo são únicos e os obrigatórios têm mensagem de erro', () => {
    const ids = corporativa.campos.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of corporativa.campos.filter((x) => x.obrigatorio)) {
      expect(c.erroObrigatorio).toMatch(/^Informe .+\.$/);
    }
  });

  it('as regras de prompt são texto do Lavra: comuns e do tipo, sem repetir', () => {
    expect(REGRAS_COMUNS.length).toBeGreaterThan(3);
    expect(corporativa.regrasPrompt.length).toBeGreaterThan(0);
    const todas = [...REGRAS_COMUNS, ...corporativa.regrasPrompt];
    expect(new Set(todas).size).toBe(todas.length);
  });
});

describe('chaves de seção', () => {
  it('nenhum tipo usa chave reservada; a chave de avisos gerais nem tem forma de seção', () => {
    const forma = /^[a-z][a-z0-9_]*$/;
    expect(forma.test(CHAVE_AVISOS_GERAIS)).toBe(false);
    for (const tipo of Object.values(ATA_TYPES)) {
      const chaves = tipo.secoes.map((s) => s.chave);
      expect(new Set(chaves).size).toBe(chaves.length);
      for (const chave of chaves) {
        expect(chave).toMatch(forma);
        expect([CHAVE_ENCAMINHAMENTOS, CHAVE_AVISOS_GERAIS]).not.toContain(chave);
      }
    }
  });
});

describe('transcricaoExcedeLimite', () => {
  it('vale só acima do limite (fonte única do bloco e de camposFaltando)', () => {
    expect(transcricaoExcedeLimite('a'.repeat(LIMITE_TRANSCRICAO))).toBe(false);
    expect(transcricaoExcedeLimite('a'.repeat(LIMITE_TRANSCRICAO + 1))).toBe(true);
  });
});

describe('camposFaltando', () => {
  it('em rascunho vazio lista tudo que a ata corporativa exige', () => {
    const faltas = camposFaltando(criarRascunho(), corporativa);
    expect(faltas.map((f) => [f.bloco, f.campo])).toEqual([
      ['dados', 'organizacao'],
      ['dados', 'assunto'],
      ['dados', 'data'],
      ['dados', 'inicio'],
      ['dados', 'modalidade'],
      ['dados', 'pauta'],
      ['participantes', 'participantes'],
      ['transcricao', 'transcricao'],
    ]);
    expect(faltas.map((f) => f.rotulo)).toEqual([
      'Organização',
      'Assunto',
      'Data',
      'Início',
      'Modalidade',
      'Pauta',
      'Participante presente',
      'Transcrição',
    ]);
  });

  it('rascunho completo não tem faltas', () => {
    expect(camposFaltando(completo(), corporativa)).toEqual([]);
  });

  it('espaços em branco contam como vazio', () => {
    const d = completo({ transcricao: '   \n ', pauta: ['  '] });
    expect(camposFaltando(d, corporativa).map((f) => f.campo)).toEqual(['pauta', 'transcricao']);
  });

  it('transcrição acima do limite bloqueia (mesma fonte para o bloco e a barra de geração)', () => {
    const no = completo({ transcricao: 'a'.repeat(LIMITE_TRANSCRICAO) });
    expect(camposFaltando(no, corporativa)).toEqual([]);
    const acima = completo({ transcricao: 'a'.repeat(LIMITE_TRANSCRICAO + 1) });
    expect(camposFaltando(acima, corporativa)).toEqual([
      { bloco: 'transcricao', campo: 'transcricao', rotulo: 'Transcrição dentro do limite' },
    ]);
  });

  it('local só falta quando a modalidade é presencial ou híbrida', () => {
    const base = completo();
    const com = (modalidade: string) =>
      camposFaltando({ ...base, dados: { ...base.dados, modalidade } }, corporativa).map(
        (f) => f.campo,
      );
    expect(com('remota')).toEqual([]);
    expect(com('presencial')).toEqual(['local']);
    expect(com('hibrida')).toEqual(['local']);
  });

  it('o rótulo do local vira "Plataforma" na modalidade remota', () => {
    const campoLocal = corporativa.campos.find((c) => c.id === 'local');
    if (!campoLocal) throw new Error('campo local ausente');
    expect(rotuloDoCampo(campoLocal, { modalidade: 'remota' })).toBe('Plataforma');
    expect(rotuloDoCampo(campoLocal, { modalidade: 'presencial' })).toBe('Local');
    expect(ehObrigatorio(campoLocal, { modalidade: 'remota' })).toBe(false);
    expect(ehObrigatorio(campoLocal, { modalidade: 'presencial' })).toBe(true);
  });

  it('exige ao menos um participante presente; ausentes não bastam', () => {
    const so = (...ps: Participante[]) =>
      camposFaltando(completo({ participantes: ps }), corporativa).map((f) => f.campo);
    expect(so()).toEqual(['participantes']);
    expect(so(participante({ presenca: 'ausente' }))).toEqual(['participantes']);
    expect(so(participante({ presenca: 'justificado' }))).toEqual(['participantes']);
    expect(so(participante({ presenca: 'ausente' }), participante({ id: 'p2' }))).toEqual([]);
  });

  it('participante sem nome é apontado', () => {
    const d = completo({ participantes: [participante(), participante({ id: 'p2', nome: ' ' })] });
    const faltas = camposFaltando(d, corporativa);
    expect(faltas).toEqual([
      { bloco: 'participantes', campo: 'nome', rotulo: 'Nome do participante' },
    ]);
  });

  it('campo extra obrigatório do participante é exigido', () => {
    const tipo: AtaTypeDefinition = {
      ...corporativa,
      camposParticipante: [
        { id: 'unidade', rotulo: 'Unidade', tipo: 'texto', obrigatorio: true },
        { id: 'obs', rotulo: 'Observação', tipo: 'texto', obrigatorio: false },
      ],
    };
    const faltas = camposFaltando(completo(), tipo);
    expect(faltas).toEqual([{ bloco: 'participantes', campo: 'unidade', rotulo: 'Unidade' }]);
    const ok = completo({ participantes: [participante({ extras: { unidade: '12' } })] });
    expect(camposFaltando(ok, tipo)).toEqual([]);
  });
});

describe('titulo', () => {
  it('gera "Ata de reunião — <assunto>"', () => {
    expect(corporativa.titulo({ assunto: 'Planejamento trimestral' })).toBe(
      'Ata de reunião — Planejamento trimestral',
    );
  });

  it('sem assunto, fica só "Ata de reunião"', () => {
    expect(corporativa.titulo({})).toBe('Ata de reunião');
    expect(corporativa.titulo({ assunto: '  ' })).toBe('Ata de reunião');
  });
});

describe('preambulo', () => {
  it('usa data por extenso e hora no formato brasileiro', () => {
    const texto = corporativa.preambulo(
      completo({
        dados: {
          organizacao: 'Empresa Exemplo Ltda.',
          assunto: 'Planejamento trimestral',
          data: '2026-10-14',
          inicio: '14:30',
          modalidade: 'presencial',
          local: 'sala de reuniões da sede',
        },
      }),
    );
    expect(texto).toContain('Aos catorze dias do mês de outubro de dois mil e vinte e seis');
    expect(texto).toContain('às 14h30');
    expect(texto).toContain('Empresa Exemplo Ltda.');
    expect(texto).toContain('Planejamento trimestral');
    expect(texto).toContain('presencial');
    expect(texto).toContain('sala de reuniões da sede');
    expect(texto).not.toContain('[PREENCHER');
  });

  it('modalidade remota cita a plataforma; sem plataforma, não inventa', () => {
    const base = completo();
    const remota = corporativa.preambulo({
      ...base,
      dados: { ...base.dados, modalidade: 'remota', local: 'Videoconferência corporativa' },
    });
    expect(remota).toContain('remota');
    expect(remota).toContain('Videoconferência corporativa');
    const semPlataforma = corporativa.preambulo({
      ...base,
      dados: { ...base.dados, modalidade: 'remota', local: '' },
    });
    expect(semPlataforma).not.toContain('[PREENCHER');
  });

  it('dados ausentes viram [PREENCHER: …] e nunca lançam', () => {
    let texto = '';
    expect(() => {
      texto = corporativa.preambulo(criarRascunho());
    }).not.toThrow();
    expect(texto).toContain('[PREENCHER: data da reunião]');
    expect(texto).toContain('[PREENCHER: horário de início]');
    expect(texto).toContain('[PREENCHER: organização]');
    expect(texto).toContain('[PREENCHER: modalidade]');
  });

  it('local obrigatório e ausente em reunião presencial vira [PREENCHER: local]', () => {
    const base = completo();
    const texto = corporativa.preambulo({
      ...base,
      dados: { ...base.dados, modalidade: 'presencial', local: '' },
    });
    expect(texto).toContain('[PREENCHER: local]');
  });

  it('data inválida (rascunho corrompido) também vira placeholder', () => {
    const base = completo();
    const texto = corporativa.preambulo({
      ...base,
      dados: { ...base.dados, data: '2026-02-30', inicio: '25:99' },
    });
    expect(texto).toContain('[PREENCHER: data da reunião]');
    expect(texto).toContain('[PREENCHER: horário de início]');
  });
});

describe('cabecalho', () => {
  it('lista organização, data, horário, modalidade e plataforma', () => {
    expect(
      corporativa.cabecalho(
        completo({
          dados: { ...completo().dados, modalidade: 'remota', local: 'Videoconferência' },
        }),
      ),
    ).toEqual([
      'Empresa Exemplo Ltda.',
      'Data: 14/10/2026',
      'Horário: 14h30 às 16h',
      'Modalidade: Remota',
      'Plataforma: Videoconferência',
    ]);
  });

  it('usa "Local" fora da reunião remota e só o início quando não há término', () => {
    const base = completo();
    const linhas = corporativa.cabecalho({
      ...base,
      dados: { ...base.dados, modalidade: 'presencial', local: 'Sala 2', fim: '' },
    });
    expect(linhas).toContain('Local: Sala 2');
    expect(linhas).toContain('Horário: 14h30');
  });

  it('omite o que não foi informado, sem lacunas nem erro', () => {
    expect(corporativa.cabecalho(criarRascunho())).toEqual([]);
    const parcial = corporativa.cabecalho({
      ...criarRascunho(),
      dados: { data: '2026-02-30', inicio: '25:00', modalidade: 'inexistente' },
    });
    expect(parcial).toEqual([]);
  });
});

describe('fecho e assinaturas', () => {
  it('fecho cita o horário de encerramento quando informado', () => {
    expect(corporativa.fecho(completo())).toContain('16h');
  });

  it('fecho sem término não lança nem cita horário', () => {
    const base = completo();
    const texto = corporativa.fecho({ ...base, dados: { ...base.dados, fim: '' } });
    expect(texto).not.toMatch(/\dh/);
    expect(texto).not.toContain('[PREENCHER');
  });

  it('assinaturas: condução e redação, só quando informadas', () => {
    expect(corporativa.assinaturas(completo())).toEqual([
      {
        titulo: null,
        pessoas: [
          { nome: 'Ana Souza', papel: 'Condução' },
          { nome: 'Bruno Lima', papel: 'Redação' },
        ],
      },
    ]);
    expect(corporativa.assinaturas(criarRascunho())).toEqual([]);
  });
});
