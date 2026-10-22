import { describe, expect, it } from 'vitest';
import { corporativa } from '../ata-types/corporativa';
import type { AtaTypeDefinition } from '../ata-types/types';
import {
  AVISO_MINUTA,
  COR_TEXTO_DOCUMENTO,
  RODAPE_PAGINADO,
  TEXTO_SECOES_PENDENTES,
} from '../config/documento';
import {
  ROTULO_PRESENCA,
  ROTULO_STATUS,
  type AtaDraft,
  type Participante,
  type ResultadoAta,
} from '../domain/draft';
import { criarRascunho } from '../domain/draft-reducer';
import { modeloDeVolume } from '../test/documento-volume';
import { TIPO_DE_TESTE } from '../test/tipo-de-teste';
import { largurasPorPeso } from './larguras';
import {
  construirDocumento,
  contarPreencher,
  dividirPreencher,
  textosDoDocumento,
} from './build-model';
import type { DocBloco, LogoDoc } from './model';

function participante(i: number, parcial: Partial<Participante> = {}): Participante {
  return {
    id: `p${String(i)}`,
    nome: `Pessoa ${String(i)}`,
    papel: `Cargo ${String(i)}`,
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
      organizacao: 'Cooperativa Fictícia',
      assunto: 'Reembolsos',
      data: '2026-10-14',
      inicio: '14:30',
      fim: '16:00',
      modalidade: 'remota',
      local: 'Videoconferência',
      conducao: 'Ana Souza',
      redacao: 'Bruno Lima',
    },
    pauta: ['Reembolsos', 'Orçamento'],
    participantes: [participante(1), participante(2, { presenca: 'ausente' })],
    ...parcial,
  };
}

function resultado(parcial: Partial<ResultadoAta> = {}): ResultadoAta {
  return {
    secoes: {
      resumo: [{ tipo: 'paragrafo', texto: 'Foi tratado o reembolso.', itens: [] }],
      discussao: [],
      decisoes: [
        { tipo: 'lista', texto: '', itens: ['Aprovar o reembolso', 'Revisar a política'] },
      ],
      pendencias: [],
      riscos: [],
      proxima_reuniao: [],
    },
    encaminhamentos: [
      {
        acao: 'Enviar a planilha',
        responsavel: 'Ana Souza',
        prazo: '2026-10-30',
        status: 'em_andamento',
      },
      { acao: 'Rever o fluxo', responsavel: '', prazo: 'próxima reunião', status: 'pendente' },
      { acao: 'Avisar o time', responsavel: 'Bruno Lima', prazo: '', status: 'concluido' },
    ],
    atribuicao: {},
    avisos: {},
    editadas: [],
    ...parcial,
  };
}

type Secao = Extract<DocBloco, { tipo: 'secao' }>;
type Tabela = Extract<DocBloco, { tipo: 'tabela' }>;

function secoes(blocos: DocBloco[]): Secao[] {
  return blocos.filter((b): b is Secao => b.tipo === 'secao');
}

function tabelas(blocos: DocBloco[]): Tabela[] {
  return blocos.flatMap((b) =>
    b.tipo === 'tabela' ? [b] : b.tipo === 'secao' ? tabelas(b.blocos) : [],
  );
}

describe('dividirPreencher', () => {
  it('transforma [PREENCHER: …] em destaque e mantém o texto em volta', () => {
    expect(dividirPreencher('Reunião em [PREENCHER: local] às 14h.')).toEqual([
      { texto: 'Reunião em ' },
      { texto: '[PREENCHER: local]', destaque: 'preencher' },
      { texto: ' às 14h.' },
    ]);
  });

  it('trata vários marcadores, texto sem marcador e texto vazio', () => {
    expect(dividirPreencher('[PREENCHER: a][PREENCHER: b]')).toEqual([
      { texto: '[PREENCHER: a]', destaque: 'preencher' },
      { texto: '[PREENCHER: b]', destaque: 'preencher' },
    ]);
    expect(dividirPreencher('sem lacuna')).toEqual([{ texto: 'sem lacuna' }]);
    expect(dividirPreencher('')).toEqual([]);
  });

  it('não confunde colchetes comuns nem marcador em minúsculas', () => {
    expect(dividirPreencher('Ver [anexo 1] e [preencher: x]')).toEqual([
      { texto: 'Ver [anexo 1] e [preencher: x]' },
    ]);
  });
});

describe('construirDocumento sem resultado (prévia ao vivo)', () => {
  const modelo = construirDocumento(rascunho(), corporativa);

  it('traz título e cabeçalho com os dados já digitados', () => {
    expect(modelo.titulo).toBe('Ata de reunião — Reembolsos');
    expect(modelo.cabecalho.logo).toBeNull();
    expect(modelo.cabecalho.linhas).toEqual([
      'Cooperativa Fictícia',
      'Data: 14/10/2026',
      'Horário: 14h30 às 16h',
      'Modalidade: Remota',
      'Plataforma: Videoconferência',
    ]);
  });

  it('lista os participantes em tabela com a presença por extenso', () => {
    const [tabela] = tabelas(modelo.blocos);
    expect(tabela?.colunas).toEqual(['Nome', 'Cargo / empresa', 'Presença']);
    expect(tabela?.linhas).toEqual([
      ['Pessoa 1', 'Cargo 1', ROTULO_PRESENCA.presente],
      ['Pessoa 2', 'Cargo 2', ROTULO_PRESENCA.ausente],
    ]);
    expect(tabela?.colunaPresenca).toBe(2);
    expect(tabela?.presencas).toEqual(['presente', 'ausente']);
  });

  it('mostra a pauta como lista', () => {
    const lista = modelo.blocos.find((b) => b.tipo === 'lista');
    expect(lista).toEqual({
      tipo: 'lista',
      itens: [[{ texto: 'Reembolsos' }], [{ texto: 'Orçamento' }]],
    });
  });

  it('deixa um único placeholder no lugar das seções e omite preâmbulo, fecho e aviso', () => {
    const [placeholder, ...outras] = secoes(modelo.blocos);
    expect(outras).toEqual([]);
    expect(placeholder?.gerada).toBe(false);
    expect(placeholder?.blocos).toEqual([
      { tipo: 'paragrafo', partes: [{ texto: TEXTO_SECOES_PENDENTES }] },
    ]);
    expect(modelo.blocos.some((b) => b.tipo === 'aviso' || b.tipo === 'assinaturas')).toBe(false);
    expect(JSON.stringify(modelo.blocos)).not.toContain('lavrada');
  });

  it('não inventa lacunas para o que ainda não foi digitado', () => {
    const vazio = construirDocumento(criarRascunho(), corporativa);
    expect(vazio.titulo).toBe('Ata de reunião');
    expect(vazio.cabecalho.linhas).toEqual([]);
    expect(contarPreencher(vazio)).toBe(0);
    expect(tabelas(vazio.blocos)).toEqual([]);
  });

  it('imprime a justificativa só de quem está justificado, ignorando texto antigo', () => {
    const d = rascunho({
      participantes: [
        participante(1, { presenca: 'presente', justificativa: 'texto que sobrou' }),
        participante(2, { presenca: 'justificado', justificativa: 'Consulta médica' }),
        participante(3, { presenca: 'justificado', justificativa: '' }),
      ],
    });
    const [tabela] = tabelas(construirDocumento(d, corporativa).blocos);
    expect(tabela?.linhas.map((l) => l[2])).toEqual([
      ROTULO_PRESENCA.presente,
      `${ROTULO_PRESENCA.justificado}: Consulta médica`,
      ROTULO_PRESENCA.justificado,
    ]);
  });

  it('usa um traço para nome ou cargo em branco', () => {
    const d = rascunho({
      participantes: [participante(1, { nome: ' ', papel: '' }), participante(2)],
    });
    const [tabela] = tabelas(construirDocumento(d, corporativa).blocos);
    expect(tabela?.linhas[0]).toEqual(['—', '—', ROTULO_PRESENCA.presente]);
  });

  it('pede o cabeçalho ao tipo, sem depender dos campos do corporativo', () => {
    const outro: AtaTypeDefinition = { ...corporativa, cabecalho: () => ['Linha do outro tipo'] };
    expect(construirDocumento(rascunho(), outro).cabecalho.linhas).toEqual(['Linha do outro tipo']);
  });

  it('transforma 200 participantes em 200 linhas', () => {
    const d = rascunho({
      participantes: Array.from({ length: 200 }, (_, i) => participante(i + 1)),
    });
    const [tabela] = tabelas(construirDocumento(d, corporativa).blocos);
    expect(tabela?.linhas).toHaveLength(200);
    expect(tabela?.linhas[199]?.[0]).toBe('Pessoa 200');
  });

  it('acrescenta uma coluna por campo extra do participante', () => {
    const tipo: AtaTypeDefinition = {
      ...corporativa,
      camposParticipante: [
        {
          id: 'condicao',
          rotulo: 'Condição',
          tipo: 'escolha',
          obrigatorio: false,
          opcoes: [{ valor: 'titular', rotulo: 'Titular' }],
        },
        { id: 'unidade', rotulo: 'Unidade', tipo: 'texto', obrigatorio: false },
      ],
    };
    const d = rascunho({
      participantes: [
        participante(1, { extras: { condicao: 'titular' } }),
        participante(2, { extras: { unidade: 'Apto 2' } }),
      ],
    });
    const [tabela] = tabelas(construirDocumento(d, tipo).blocos);
    expect(tabela?.colunas).toEqual(['Nome', 'Cargo / empresa', 'Condição', 'Unidade', 'Presença']);
    expect(tabela?.linhas[0]).toEqual([
      'Pessoa 1',
      'Cargo 1',
      'Titular',
      '—',
      ROTULO_PRESENCA.presente,
    ]);
    expect(tabela?.colunaPresenca).toBe(4);
  });

  it('omite a coluna opcional que ninguém preencheu (nunca uma coluna inteira de “—”)', () => {
    const tipo: AtaTypeDefinition = {
      ...corporativa,
      camposParticipante: [
        { id: 'unidade', rotulo: 'Unidade', tipo: 'texto', obrigatorio: false, peso: 1.5 },
        { id: 'vinculo', rotulo: 'Vínculo', tipo: 'texto', obrigatorio: true, peso: 2 },
      ],
    };
    const d = rascunho({
      participantes: [participante(1, { papel: ' ' }), participante(2, { papel: '' })],
    });
    const [tabela] = tabelas(construirDocumento(d, tipo).blocos);
    // Papel e unidade (opcionais) vazios em todos saem; o obrigatório fica, mesmo vazio.
    expect(tabela?.colunas).toEqual(['Nome', 'Vínculo', 'Presença']);
    expect(tabela?.linhas[0]).toEqual(['Pessoa 1', '—', ROTULO_PRESENCA.presente]);
    expect(tabela?.colunaPresenca).toBe(2);
    expect(tabela?.larguras).toEqual(largurasPorPeso([3, 2, 2]));
  });
});

describe('construirDocumento: cor de destaque', () => {
  it('sem o 4º argumento, a cor é a tinta do documento', () => {
    expect(construirDocumento(rascunho(), corporativa).corDestaque).toBe(COR_TEXTO_DOCUMENTO);
  });

  it('com um destaque, a cor dele', () => {
    expect(construirDocumento(rascunho(), corporativa, null, 'vinho').corDestaque).toBe('#7b1e3a');
  });
});

describe('construirDocumento com logo', () => {
  const logo: LogoDoc = { dataUrl: 'data:image/png;base64,AAAA', largura: 300, altura: 100 };

  it('põe a logo em cabecalho.logo', () => {
    expect(construirDocumento(rascunho(), corporativa, logo).cabecalho.logo).toEqual(logo);
  });

  it('sem o terceiro argumento, ou com null, a logo é null', () => {
    expect(construirDocumento(rascunho(), corporativa).cabecalho.logo).toBeNull();
    expect(construirDocumento(rascunho(), corporativa, null).cabecalho.logo).toBeNull();
  });

  it('a logo não muda o resto do documento', () => {
    const com = construirDocumento(rascunho(), corporativa, logo);
    const sem = construirDocumento(rascunho(), corporativa);
    expect({ ...com, cabecalho: { ...com.cabecalho, logo: null } }).toEqual(sem);
  });
});

describe('construirDocumento com resultado', () => {
  const d = rascunho({ resultado: resultado() });
  const modelo = construirDocumento(d, corporativa);

  it('abre com o preâmbulo do tipo, antes da lista de participantes', () => {
    const [primeiro] = modelo.blocos;
    expect(primeiro?.tipo).toBe('paragrafo');
    expect(JSON.stringify(primeiro)).toContain('Aos catorze dias do mês de outubro');
  });

  it('põe as seções na ordem do tipo e omite as vazias', () => {
    expect(secoes(modelo.blocos).map((s) => s.chave)).toEqual([
      'resumo',
      'decisoes',
      'encaminhamentos',
    ]);
    expect(secoes(modelo.blocos).every((s) => s.gerada)).toBe(true);
    const decisoes = secoes(modelo.blocos).find((s) => s.chave === 'decisoes');
    expect(decisoes?.titulo).toBe('Decisões');
    expect(decisoes?.blocos).toEqual([
      {
        tipo: 'lista',
        itens: [[{ texto: 'Aprovar o reembolso' }], [{ texto: 'Revisar a política' }]],
      },
    ]);
  });

  it('não mostra o placeholder depois de gerar', () => {
    expect(JSON.stringify(modelo.blocos)).not.toContain(TEXTO_SECOES_PENDENTES);
  });

  it('monta a tabela de encaminhamentos com data dd/mm/aaaa e texto livre mantido', () => {
    const enc = secoes(modelo.blocos).find((s) => s.chave === 'encaminhamentos');
    const [tabela] = tabelas(enc?.blocos ?? []);
    expect(tabela?.colunas).toEqual(['Ação', 'Responsável', 'Prazo', 'Status']);
    expect(tabela?.larguras).toEqual([50, 20, 15, 15]);
    expect(tabela?.linhas).toEqual([
      ['Enviar a planilha', 'Ana Souza', '30/10/2026', ROTULO_STATUS.em_andamento],
      ['Rever o fluxo', 'A definir', 'próxima reunião', ROTULO_STATUS.pendente],
      ['Avisar o time', 'Bruno Lima', '—', ROTULO_STATUS.concluido],
    ]);
  });

  it('mantém como texto o prazo que só parece uma data', () => {
    const r = resultado({
      encaminhamentos: [
        { acao: 'A', responsavel: 'B', prazo: '2026-02-30', status: 'pendente' },
        { acao: 'C', responsavel: 'D', prazo: '30/10/2026', status: 'pendente' },
      ],
    });
    const enc = secoes(construirDocumento(rascunho({ resultado: r }), corporativa).blocos).find(
      (s) => s.chave === 'encaminhamentos',
    );
    const [tabela] = tabelas(enc?.blocos ?? []);
    expect(tabela?.linhas.map((l) => l[2])).toEqual(['2026-02-30', '30/10/2026']);
  });

  it('omite a seção de encaminhamentos quando não há nenhum', () => {
    const sem = construirDocumento(
      rascunho({ resultado: resultado({ encaminhamentos: [] }) }),
      corporativa,
    );
    expect(secoes(sem.blocos).map((s) => s.chave)).not.toContain('encaminhamentos');
  });

  it('fecha com o fecho, as assinaturas e o aviso de minuta, nessa ordem', () => {
    const fim = modelo.blocos.slice(-3);
    expect(JSON.stringify(fim[0])).toContain('foi lavrada a presente ata');
    expect(fim[1]).toEqual({
      tipo: 'assinaturas',
      pessoas: [
        { nome: 'Ana Souza', papel: 'Condução' },
        { nome: 'Bruno Lima', papel: 'Redação' },
      ],
    });
    expect(fim[2]).toEqual({ tipo: 'aviso', texto: AVISO_MINUTA });
  });

  it('omite as assinaturas quando o tipo não devolve ninguém', () => {
    const sem = construirDocumento(
      rascunho({
        resultado: resultado(),
        dados: { ...rascunho().dados, conducao: '', redacao: '' },
      }),
      corporativa,
    );
    expect(sem.blocos.some((b) => b.tipo === 'assinaturas')).toBe(false);
    expect(sem.blocos.at(-1)).toEqual({ tipo: 'aviso', texto: AVISO_MINUTA });
  });

  it('marca [PREENCHER: …] dos blocos como destaque e conta as lacunas', () => {
    const r = resultado({
      secoes: {
        ...resultado().secoes,
        resumo: [
          { tipo: 'paragrafo', texto: 'Reunião em [PREENCHER: local] hoje.', itens: [] },
          { tipo: 'lista', texto: 'Itens:', itens: ['Valor: [PREENCHER: valor]'] },
        ],
      },
    });
    const com = construirDocumento(rascunho({ resultado: r }), corporativa);
    const resumo = secoes(com.blocos).find((s) => s.chave === 'resumo');
    expect(resumo?.blocos).toEqual([
      {
        tipo: 'paragrafo',
        partes: [
          { texto: 'Reunião em ' },
          { texto: '[PREENCHER: local]', destaque: 'preencher' },
          { texto: ' hoje.' },
        ],
      },
      { tipo: 'paragrafo', partes: [{ texto: 'Itens:' }] },
      {
        tipo: 'lista',
        itens: [[{ texto: 'Valor: ' }, { texto: '[PREENCHER: valor]', destaque: 'preencher' }]],
      },
    ]);
    expect(contarPreencher(com)).toBe(2);
  });

  it('conta também as lacunas do preâmbulo e das células de tabela', () => {
    const r = resultado({
      encaminhamentos: [
        { acao: 'Pagar [PREENCHER: valor]', responsavel: 'Ana', prazo: '', status: 'pendente' },
      ],
    });
    const faltando = construirDocumento(
      rascunho({ resultado: r, dados: { organizacao: 'Cooperativa Fictícia' } }),
      corporativa,
    );
    // Preâmbulo: data, hora, modalidade, assunto; tabela: valor.
    expect(contarPreencher(faltando)).toBe(5);
  });

  it('rodapé interno lista os provedores das seções na folha, sem repetir (spec 8.1.1)', () => {
    const gemini = { provedor: 'gemini' as const, modelo: 'gemini-3.8-flash', falhas: [] };
    const openai = { provedor: 'openai' as const, modelo: 'gpt-6-luna', falhas: [] };
    const doc = construirDocumento(
      rascunho({
        resultado: resultado({
          atribuicao: {
            resumo: gemini,
            decisoes: openai,
            encaminhamentos: gemini,
            // Seção vazia não aparece na folha: o provedor dela não conta.
            riscos: { provedor: 'anthropic', modelo: 'claude-haiku-5-5', falhas: [] },
          },
        }),
      }),
      corporativa,
    );
    expect(doc.rodapeInterno).toBe(
      'Minuta gerada com auxílio de IA (Gemini · gemini-3.8-flash, OpenAI · gpt-6-luna).',
    );
    // O rodapé paginado do PDF/DOCX não muda.
    expect(doc.rodape).toBe(RODAPE_PAGINADO);
  });

  it('sem atribuição (antes de gerar ou só texto escrito à mão), não há rodapé interno', () => {
    expect(construirDocumento(rascunho(), corporativa).rodapeInterno).toBeNull();
    expect(
      construirDocumento(rascunho({ resultado: resultado() }), corporativa).rodapeInterno,
    ).toBeNull();
  });

  it('não altera o rascunho', () => {
    const antes = JSON.stringify(d);
    construirDocumento(d, corporativa);
    expect(JSON.stringify(d)).toBe(antes);
  });
});

describe('textosDoDocumento', () => {
  const modelo = modeloDeVolume({ participantes: 3, encaminhamentos: 2 });
  const textos = textosDoDocumento(modelo);

  it('traz título, cabeçalho, cabeçalhos e células de tabela, aviso de minuta e rodapé', () => {
    expect(textos).toContain(modelo.titulo);
    expect(textos).toEqual(expect.arrayContaining(modelo.cabecalho.linhas));
    expect(textos).toEqual(expect.arrayContaining(['Ação', 'Responsável', 'Prazo', 'Status']));
    expect(textos).toContain('Participante de volume nº 001 — João Ação');
    expect(textos).toContain('Resumo');
    expect(textos).toContain(AVISO_MINUTA);
    expect(textos.some((t) => t.startsWith('Página '))).toBe(true);
  });

  it('junta as partes de cada parágrafo e de cada item de lista, com a lacuna no lugar', () => {
    expect(textos).toContain(
      'A reunião ocorreu em [PREENCHER: local] e tratou do orçamento anual.',
    );
    expect(textos).toContain('Aprovar o orçamento');
  });

  it('nunca inclui o rodapé interno (só da tela), que este modelo tem', () => {
    expect(modelo.rodapeInterno).not.toBeNull();
    expect(textos.join(' ')).not.toContain(modelo.rodapeInterno);
  });

  it('contarPreencher sobre textosDoDocumento: paridade com a contagem por bloco no volume', () => {
    // Uma lacuna no resumo; cabeçalhos de tabela, títulos de seção, aviso e rodapé não têm.
    expect(contarPreencher(modelo)).toBe(1);
    expect(contarPreencher(modeloDeVolume({ participantes: 200, encaminhamentos: 200 }))).toBe(1);
  });
});

describe('construirDocumento com um tipo sem coluna de papel', () => {
  const d = {
    ...criarRascunho(TIPO_DE_TESTE.id),
    dados: { data: '2026-10-14', presidente: 'Ana Souza' },
    pauta: ['Item um'],
    participantes: [
      participante(1, { extras: { unidade: 'Apto 1', vinculo: 'procurador' } }),
      participante(2, { extras: { unidade: 'Apto 2' } }),
    ],
  };
  const modelo = construirDocumento({ ...d, resultado: resultado() }, TIPO_DE_TESTE);
  const tabela = modelo.blocos.find((b): b is Tabela => b.tipo === 'tabela');

  it('tabela com as colunas do tipo, larguras por peso e presença no índice real', () => {
    // "Fração ideal" (opcional) ninguém preencheu: sai do documento.
    expect(tabela?.colunas).toEqual(['Nome', 'Unidade', 'Vínculo', 'Presença']);
    expect(tabela?.colunaPresenca).toBe(3);
    expect(tabela?.larguras).toEqual(largurasPorPeso([3, 1.5, 2, 2]));
    expect(tabela?.larguras?.reduce((a, b) => a + b, 0)).toBe(100);
    expect(tabela?.linhas[0]).toEqual(['Pessoa 1', 'Apto 1', 'Procurador(a)', 'Presente']);
    // Vínculo é obrigatório: fica, com o traço de quem não o tem.
    expect(tabela?.linhas[1]).toEqual(['Pessoa 2', 'Apto 2', '—', 'Presente']);
  });

  it('a coluna opcional volta quando alguém a preenche', () => {
    const comFracao = construirDocumento(
      {
        ...d,
        participantes: [d.participantes[0], participante(2, { extras: { fracao: '0,5' } })].filter(
          (p): p is Participante => p !== undefined,
        ),
        resultado: resultado(),
      },
      TIPO_DE_TESTE,
    ).blocos.find((b): b is Tabela => b.tipo === 'tabela');
    expect(comFracao?.colunas).toEqual(['Nome', 'Unidade', 'Vínculo', 'Fração ideal', 'Presença']);
    expect(comFracao?.linhas[0]).toEqual(['Pessoa 1', 'Apto 1', 'Procurador(a)', '—', 'Presente']);
    expect(comFracao?.larguras).toEqual([30, 15, 20, 15, 20]);
  });

  it('subtítulos vêm dos rótulos do tipo', () => {
    const subtitulos = modelo.blocos.flatMap((b) => (b.tipo === 'subtitulo' ? [b.texto] : []));
    expect(subtitulos).toEqual(['Membros', 'Ordem do dia', 'Mesa', 'Membros presentes']);
  });

  it('cada grupo de assinatura vira subtítulo + bloco com o título do grupo', () => {
    const i = modelo.blocos.findIndex((b) => b.tipo === 'assinaturas');
    expect(modelo.blocos.slice(i - 1, i + 3)).toEqual([
      { tipo: 'subtitulo', texto: 'Mesa' },
      { tipo: 'assinaturas', grupo: 'Mesa', pessoas: [{ nome: 'Ana Souza', papel: 'Presidente' }] },
      { tipo: 'subtitulo', texto: 'Membros presentes' },
      {
        tipo: 'assinaturas',
        grupo: 'Membros presentes',
        pessoas: [
          { nome: 'Pessoa 1', papel: 'Procurador(a)' },
          { nome: 'Pessoa 2', papel: '' },
        ],
      },
    ]);
  });

  it('grupo sem pessoas é omitido (nem subtítulo nem bloco)', () => {
    const semMesa = construirDocumento(
      { ...d, dados: { data: '2026-10-14' }, resultado: resultado() },
      TIPO_DE_TESTE,
    );
    expect(semMesa.blocos.filter((b) => b.tipo === 'assinaturas')).toHaveLength(1);
    const titulos = semMesa.blocos.flatMap((b) => (b.tipo === 'subtitulo' ? [b.texto] : []));
    expect(titulos).not.toContain('Mesa');
    expect(titulos).toContain('Membros presentes');

    const ninguem = construirDocumento(
      {
        ...d,
        dados: { data: '2026-10-14' },
        participantes: [participante(1, { presenca: 'ausente' })],
        resultado: resultado(),
      },
      TIPO_DE_TESTE,
    );
    expect(ninguem.blocos.some((b) => b.tipo === 'assinaturas')).toBe(false);
  });

  it('o aviso final do tipo vem logo depois do aviso de minuta', () => {
    expect(modelo.blocos.slice(-2)).toEqual([
      { tipo: 'aviso', texto: AVISO_MINUTA },
      { tipo: 'aviso', texto: 'Aviso final de teste.' },
    ]);
  });

  it('antes de gerar não há assinaturas nem avisos', () => {
    const previa = construirDocumento(d, TIPO_DE_TESTE);
    expect(previa.blocos.some((b) => b.tipo === 'assinaturas' || b.tipo === 'aviso')).toBe(false);
  });

  it('textosDoDocumento inclui os títulos de grupo e os avisos finais (e conta lacunas neles)', () => {
    const textos = textosDoDocumento(modelo);
    expect(textos).toEqual(
      expect.arrayContaining(['Mesa', 'Membros presentes', 'Aviso final de teste.']),
    );
    const comLacuna = construirDocumento(
      { ...d, resultado: resultado() },
      { ...TIPO_DE_TESTE, avisosFinais: () => ['Falta [PREENCHER: a data da assembleia].'] },
    );
    expect(contarPreencher(comLacuna)).toBe(1 + contarPreencher(modelo));
  });
});

describe('construirDocumento: a corporativa não muda (paridade)', () => {
  const GOLDEN_SEM =
    '{"titulo":"Ata de reunião — Reembolsos","cabecalho":{"logo":null,"linhas":["Cooperativa Fictícia","Data: 14/10/2026","Horário: 14h30 às 16h","Modalidade: Remota","Plataforma: Videoconferência"]},"blocos":[{"tipo":"subtitulo","texto":"Participantes"},{"tipo":"tabela","colunas":["Nome","Cargo / empresa","Presença"],"linhas":[["Pessoa 1","Cargo 1","Presente"],["Pessoa 2","Cargo 2","Ausente"]],"colunaPresenca":2,"presencas":["presente","ausente"]},{"tipo":"subtitulo","texto":"Pauta"},{"tipo":"lista","itens":[[{"texto":"Reembolsos"}],[{"texto":"Orçamento"}]]},{"tipo":"secao","chave":"pendente","titulo":"Seções da ata","blocos":[{"tipo":"paragrafo","partes":[{"texto":"As seções aparecem aqui depois de gerar a ata."}]}],"gerada":false}],"rodape":"Página {pagina} de {total}","rodapeInterno":null}';
  const GOLDEN_COM =
    '{"titulo":"Ata de reunião — Reembolsos","cabecalho":{"logo":null,"linhas":["Cooperativa Fictícia","Data: 14/10/2026","Horário: 14h30 às 16h","Modalidade: Remota","Plataforma: Videoconferência"]},"blocos":[{"tipo":"paragrafo","partes":[{"texto":"Aos catorze dias do mês de outubro de dois mil e vinte e seis, às 14h30, de forma remota, por meio de Videoconferência, realizou-se reunião de Cooperativa Fictícia, com o assunto “Reembolsos”. A reunião foi conduzida por Ana Souza. A ata foi redigida por Bruno Lima. Participaram as pessoas relacionadas a seguir."}]},{"tipo":"subtitulo","texto":"Participantes"},{"tipo":"tabela","colunas":["Nome","Cargo / empresa","Presença"],"linhas":[["Pessoa 1","Cargo 1","Presente"],["Pessoa 2","Cargo 2","Ausente"]],"colunaPresenca":2,"presencas":["presente","ausente"]},{"tipo":"subtitulo","texto":"Pauta"},{"tipo":"lista","itens":[[{"texto":"Reembolsos"}],[{"texto":"Orçamento"}]]},{"tipo":"secao","chave":"resumo","titulo":"Resumo","blocos":[{"tipo":"paragrafo","partes":[{"texto":"Foi tratado o reembolso."}]}],"gerada":true},{"tipo":"secao","chave":"decisoes","titulo":"Decisões","blocos":[{"tipo":"lista","itens":[[{"texto":"Aprovar o reembolso"}],[{"texto":"Revisar a política"}]]}],"gerada":true},{"tipo":"secao","chave":"encaminhamentos","titulo":"Encaminhamentos","blocos":[{"tipo":"tabela","colunas":["Ação","Responsável","Prazo","Status"],"linhas":[["Enviar a planilha","Ana Souza","30/10/2026","Em andamento"],["Rever o fluxo","A definir","próxima reunião","Pendente"],["Avisar o time","Bruno Lima","—","Concluído"]],"larguras":[50,20,15,15]}],"gerada":true},{"tipo":"paragrafo","partes":[{"texto":"Nada mais havendo a tratar, a reunião foi encerrada às 16h. E, para constar, foi lavrada a presente ata."}]},{"tipo":"assinaturas","pessoas":[{"nome":"Ana Souza","papel":"Condução"},{"nome":"Bruno Lima","papel":"Redação"}]},{"tipo":"aviso","texto":"Minuta elaborada com auxílio de inteligência artificial a partir de transcrição. Revise integralmente antes de assinar. Não substitui assessoria jurídica; a validade depende de convocação, quórum e assinaturas, que não foram verificados."}],"rodape":"Página {pagina} de {total}","rodapeInterno":null}';

  /** Tira só `larguras` da tabela de participantes (a única mudança do Plano 05 na corporativa). */
  function semLarguras(modelo: ReturnType<typeof construirDocumento>): string {
    const blocos = modelo.blocos.map((b) => {
      if (b.tipo !== 'tabela' || !b.colunas.includes('Presença')) return b;
      const { larguras, ...resto } = b;
      expect(larguras).toEqual([43, 29, 28]);
      return resto;
    });
    // `corDestaque` (Plano 06) é o único campo novo: no padrão é a tinta, e o resto é idêntico.
    const { corDestaque, ...resto } = modelo;
    expect(corDestaque).toBe(COR_TEXTO_DOCUMENTO);
    return JSON.stringify({ ...resto, blocos });
  }

  it('antes de gerar: idêntico ao modelo gravado antes da mudança', () => {
    expect(semLarguras(construirDocumento(rascunho(), corporativa))).toBe(GOLDEN_SEM);
  });

  it('depois de gerar: idêntico, com assinaturas num bloco único sem título de grupo', () => {
    const modelo = construirDocumento(rascunho({ resultado: resultado() }), corporativa);
    expect(semLarguras(modelo)).toBe(GOLDEN_COM);
    const bloco = modelo.blocos.find((b) => b.tipo === 'assinaturas');
    expect(bloco).toBeDefined();
    expect(bloco).not.toHaveProperty('grupo');
    expect(modelo.blocos.at(-1)).toEqual({ tipo: 'aviso', texto: AVISO_MINUTA });
  });
});
