import { describe, expect, it } from 'vitest';
import { LIMITE_TRANSCRICAO } from '../../config/limits';
import {
  CATEGORIAS_SENSIVEIS,
  MAX_TRECHOS_SENSIVEIS_VISIVEIS,
  PADRAO_CODIGO_CID,
} from '../../config/termos-sensiveis';
import { normalizarBusca } from '../form/lista-participantes';
import {
  categoriasDosAchados,
  detectarTermosSensiveis,
  ehTermoSensivel,
  rotuloDaCategoria,
  trechosDistintos,
} from './termos-sensiveis';

/** Trechos achados, como aparecem no texto original, com a categoria. */
function achar(texto: string): [string, string][] {
  return detectarTermosSensiveis(texto).map((a) => [texto.slice(a.start, a.end), a.categoria]);
}

describe('detectarTermosSensiveis: cenários do comentário', () => {
  it('nome + afastamento + diagnóstico: "Joana está afastada por depressão desde março"', () => {
    expect(achar('Joana está afastada por depressão desde março.')).toEqual([
      ['afastada por', 'saude'],
      ['depressão', 'saude'],
    ]);
  });

  it('conflito trabalhista: "entrou com processo trabalhista"', () => {
    expect(achar('O Carlos entrou com processo trabalhista contra a empresa.')).toEqual([
      ['processo trabalhista', 'trabalhista'],
    ]);
  });

  it('código da CID entra inteiro no trecho', () => {
    expect(achar('Apresentou atestado médico com CID F32.1 ontem.')).toEqual([
      ['atestado médico', 'saude'],
      ['CID F32.1', 'saude'],
    ]);
    expect(achar('atestado com CID F32.1')).toEqual([['CID F32.1', 'saude']]);
    expect(achar('CID-10: F32.1')).toEqual([['CID-10: F32.1', 'saude']]);
    expect(achar('cid m54 e CID F32')).toEqual([
      ['cid m54', 'saude'],
      ['CID F32', 'saude'],
    ]);
  });

  it('afastamento e diagnóstico com contexto de pessoa', () => {
    expect(achar('Ele foi afastado do trabalho; o afastamento médico vai até maio.')).toEqual([
      ['afastado do trabalho', 'saude'],
      ['afastamento médico', 'saude'],
    ]);
    expect(achar('Foi diagnosticada com ansiedade; o diagnóstico médico saiu ontem.')).toEqual([
      ['diagnosticada com', 'saude'],
      ['ansiedade', 'saude'],
      ['diagnóstico médico', 'saude'],
    ]);
  });
});

describe('detectarTermosSensiveis: forma do texto', () => {
  it('maiúsculas e sem acento casam do mesmo jeito', () => {
    expect(achar('AFASTADA POR DEPRESSAO')).toEqual([
      ['AFASTADA POR', 'saude'],
      ['DEPRESSAO', 'saude'],
    ]);
    expect(achar('Licença Médica e LICENCA MEDICA')).toEqual([
      ['Licença Médica', 'saude'],
      ['LICENCA MEDICA', 'saude'],
    ]);
  });

  it('termo composto com quebra de linha ou espaços repetidos', () => {
    expect(achar('entrou com processo\ntrabalhista')).toEqual([
      ['processo\ntrabalhista', 'trabalhista'],
    ]);
    expect(achar('demitido por justa   causa')).toEqual([
      ['demitido', 'trabalhista'],
      ['justa   causa', 'trabalhista'],
    ]);
  });

  it('termo composto com hífen (comum e tipográfico)', () => {
    expect(achar('Está de licença-maternidade.')).toEqual([['licença-maternidade', 'saude']]);
    expect(achar('processo‐trabalhista')).toEqual([['processo‐trabalhista', 'trabalhista']]);
  });

  it('hífen suave e espaço de largura zero (texto colado de PDF) não quebram o termo', () => {
    const suave = 'depres­são';
    expect(achar(suave)).toEqual([[suave, 'saude']]);
    const zero = 'Depres​são';
    expect(achar(zero)).toEqual([[zero, 'saude']]);
  });

  it('posições valem no texto original mesmo com acento decomposto (NFD) antes do termo', () => {
    const nfd = 'João: afastada por'.normalize('NFD');
    const [achado] = detectarTermosSensiveis(nfd);
    expect(achado && nfd.slice(achado.start, achado.end)).toBe('afastada por');
  });

  it('acento decomposto dentro do termo fica dentro do destaque', () => {
    const nfd = 'Doença grave'.normalize('NFD');
    const [achado] = detectarTermosSensiveis(nfd);
    expect(achado && nfd.slice(achado.start, achado.end)).toBe('Doença'.normalize('NFD'));
  });

  it('caractere que cresce ao virar minúscula não desloca as posições seguintes', () => {
    const texto = 'İİİ afastado por';
    expect(achar(texto)).toEqual([['afastado por', 'saude']]);
  });

  it('em ordem e sem sobreposição; categorias diferentes no mesmo texto', () => {
    const texto =
      'Assédio relatado; filiação partidária citada; cor ou raça; orientação sexual; biometria; sindicato.';
    expect(achar(texto)).toEqual([
      ['Assédio', 'trabalhista'],
      ['filiação partidária', 'crenca'],
      ['cor ou raça', 'origem'],
      ['orientação sexual', 'sexual'],
      ['biometria', 'biometria'],
      ['sindicato', 'crenca'],
    ]);
    const achados = detectarTermosSensiveis(texto);
    for (let i = 1; i < achados.length; i++) {
      expect(achados[i]?.start).toBeGreaterThanOrEqual(achados[i - 1]?.end ?? Infinity);
    }
  });

  it('o achado traz o discriminante de termo sensível', () => {
    const [achado] = detectarTermosSensiveis('depressão');
    expect(achado && ehTermoSensivel(achado)).toBe(true);
    expect(ehTermoSensivel({ start: 0, end: 1, categoria: 'x' })).toBe(false);
  });

  it('texto vazio não acha nada', () => {
    expect(detectarTermosSensiveis('')).toEqual([]);
  });
});

describe('detectarTermosSensiveis: sem falso positivo em palavras parecidas', () => {
  it.each([
    'Precisamos afastar o risco de atraso.',
    'O tratamento das pendências ficou para a próxima reunião.',
    'O desligamento do servidor será às 22h.',
    'O laudo da vistoria do telhado chegou.',
    'Há deficiência nos controles de estoque.',
    'A cidade aprovou a obra; a cidadania agradece.',
    'Graça e Cidinha confirmaram presença.',
    'O sindico apresentou o orçamento.',
    'Demissionário não é termo da lista.',
    // Exemplos da revisão: radical genérico em ata corporativa, de condomínio ou jurídica.
    'Fizemos o diagnóstico do sistema de TI.',
    'O risco foi afastado pela auditoria.',
    'Afastada a preliminar, o juiz seguiu.',
    'Juntamos o atestado de capacidade técnica da licitação.',
    'Fizemos na raça.',
    'Cão de raça grande no elevador.',
    'A sede fica na Rua da Igreja, 100.',
    'Cid Gomes confirmou presença.',
    'A segurança psicológica da equipe melhorou.',
  ])('%s', (texto) => {
    expect(achar(texto)).toEqual([]);
  });
});

describe('detectarTermosSensiveis: limites documentados (falsos negativos)', () => {
  it('LIMITE: frase sensível sem termo da lista passa sem aviso', () => {
    // Fala de saúde e de conflito sem nenhuma palavra da lista: o aviso não aparece. A lista é
    // um aviso, não uma proteção; o README diz isso em "O que não é protegido".
    expect(
      achar('A Joana está em casa se recuperando, o médico pediu repouso de 30 dias.'),
    ).toEqual([]);
    expect(achar('O Pedro vai levar a empresa ao juiz por causa das horas extras.')).toEqual([]);
  });

  it('LIMITE: a sigla da CID sem código não avisa ("Cid" também é nome)', () => {
    expect(achar('Faltou informar o CID.')).toEqual([]);
  });

  it('hífen é fronteira de palavra: "pós-depressão" avisa', () => {
    expect(achar('pós-depressão')).toEqual([['depressão', 'saude']]);
  });

  it('LIMITE: termo colado a outra palavra, sem separador, não é reconhecido', () => {
    expect(achar('superdepressão')).toEqual([]);
  });
});

describe('detectarTermosSensiveis: tempo com texto adversário (sem retrocesso quadrático)', () => {
  const TETO_MS = 1000;
  const medir = (texto: string): number => {
    const inicio = performance.now();
    detectarTermosSensiveis(texto);
    return performance.now() - inicio;
  };

  it.each([
    ['"CID" + espaços', `CID${' '.repeat(LIMITE_TRANSCRICAO - 3)}`],
    ['"CID" + quebras de linha', `CID${'\n'.repeat(LIMITE_TRANSCRICAO - 3)}`],
    ['"CID-" + tabulações', `CID-${'\t'.repeat(LIMITE_TRANSCRICAO - 4)}`],
    ['"processo" + espaços', `processo${' '.repeat(LIMITE_TRANSCRICAO - 8)}`],
    ['"cid " repetido', 'cid '.repeat(LIMITE_TRANSCRICAO / 4)],
    ['"afastada " repetido', 'afastada '.repeat(Math.floor(LIMITE_TRANSCRICAO / 9))],
  ])(`%s (${String(LIMITE_TRANSCRICAO)} caracteres) termina em menos de 1 s`, (_nome, texto) => {
    expect(texto.length).toBeLessThanOrEqual(LIMITE_TRANSCRICAO);
    expect(medir(texto)).toBeLessThan(TETO_MS);
  });
});

describe('lista de config/termos-sensiveis.ts', () => {
  const todos = CATEGORIAS_SENSIVEIS.flatMap((c) => c.termos);
  /** O termo sem os `*` de fim de palavra. */
  const semRadical = (termo: string) => termo.replace(/\*(?= |$)/g, '');

  it('cada termo está normalizado (minúsculas, sem acento, espaço simples), * só no fim de palavra', () => {
    expect(todos.length).toBeGreaterThan(0);
    for (const termo of todos) {
      const base = semRadical(termo);
      expect(normalizarBusca(base)).toBe(base);
      expect(base).not.toContain('*');
      expect(base).toMatch(/^[a-z0-9 ]+$/);
    }
  });

  it('sem repetição entre categorias, e ids únicos', () => {
    expect(new Set(todos).size).toBe(todos.length);
    const ids = CATEGORIAS_SENSIVEIS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('nenhum termo genérico demais (decisão registrada no arquivo)', () => {
    for (const generico of [
      'tratamento',
      'desligamento',
      'laudo*',
      'laudo',
      'deficiencia*',
      'diagnostic*',
      'afastad*',
      'atestado*',
      'psicolog*',
      'raca',
      'igreja*',
      'cid',
    ]) {
      expect(todos).not.toContain(generico);
    }
  });

  it('o padrão da CID aponta para uma categoria existente', () => {
    expect(CATEGORIAS_SENSIVEIS.map((c) => c.id)).toContain(PADRAO_CODIGO_CID.categoria);
  });

  it('cada termo é achado no próprio texto (nenhum fica morto por outro mais curto)', () => {
    for (const c of CATEGORIAS_SENSIVEIS) {
      for (const termo of c.termos) {
        const exemplo = termo.replace(/\*(?= |$)/g, 'x');
        expect(achar(`Antes ${exemplo} depois`)).toEqual([[exemplo, c.id]]);
      }
    }
  });
});

describe('apoio do aviso', () => {
  it('categorias na ordem da config, sem repetir', () => {
    const achados = detectarTermosSensiveis(
      'sindicato, atestado médico, demitida, atestados médicos',
    );
    expect(categoriasDosAchados(achados)).toEqual([
      'saúde',
      'conflito trabalhista',
      'filiação sindical, política ou religiosa',
    ]);
    expect(rotuloDaCategoria('saude')).toBe('saúde');
  });

  it('trechos distintos ignoram caixa, acento e espaço; mantêm a primeira grafia', () => {
    const texto =
      'Afastada por. afastada por. AFASTADA POR. processo\ntrabalhista. Processo trabalhista.';
    expect(trechosDistintos(texto, detectarTermosSensiveis(texto))).toEqual([
      { trecho: 'Afastada por', categoria: 'saude' },
      { trecho: 'processo trabalhista', categoria: 'trabalhista' },
    ]);
  });

  it('o limite visível do aviso é um número positivo', () => {
    expect(MAX_TRECHOS_SENSIVEIS_VISIVEIS).toBeGreaterThan(0);
  });
});
