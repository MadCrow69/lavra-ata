import type { ContextPageSize, Node, NodeQueries, TDocumentDefinitions } from 'pdfmake/interfaces';
import { describe, expect, it } from 'vitest';
import {
  AVISO_MINUTA,
  COR_FUNDO_PREENCHER,
  COR_TEXTO_DOCUMENTO,
  PAGINA_DOCUMENTO,
  TIPOGRAFIA_DOCUMENTO,
} from '../../config/documento';
import type { DocumentModel } from '../../document/model';
import { LOGO_TESTE, modeloDeVolume } from '../../test/documento-volume';
import { ID_NO_RODAPE, definicaoPdf } from './definicao';

type Obj = Record<string, unknown>;

const ehObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Todo objeto da definição, em profundidade (nós, células, trechos de texto). */
function* objetos(x: unknown): Generator<Obj> {
  if (Array.isArray(x)) {
    for (const item of x) yield* objetos(item);
  } else if (ehObj(x)) {
    yield x;
    for (const valor of Object.values(x)) yield* objetos(valor);
  }
}

/** Texto visível de um nó, juntando os trechos (`text` pode ser string, trecho ou lista). */
function achatar(x: unknown): string {
  if (typeof x === 'string') return x;
  if (Array.isArray(x)) return x.map(achatar).join('');
  if (ehObj(x)) {
    if ('text' in x) return achatar(x.text);
    if ('stack' in x) return achatar(x.stack);
  }
  return '';
}

interface TabelaPdf {
  headerRows?: number;
  dontBreakRows?: boolean;
  keepWithHeaderRows?: number;
  widths?: unknown[];
  body: unknown[][];
}

function tabelas(def: TDocumentDefinitions): { no: Obj; table: TabelaPdf }[] {
  return [...objetos(def.content)].flatMap((no) =>
    ehObj(no.table) ? [{ no, table: no.table as unknown as TabelaPdf }] : [],
  );
}

function tabelaComCabecalho(def: TDocumentDefinitions, coluna: string) {
  const achada = tabelas(def).find(({ table }) => table.body[0]?.map(achatar).includes(coluna));
  if (!achada) throw new Error(`tabela com a coluna ${coluna} não encontrada`);
  return achada;
}

const TAMANHO = { participantes: 5, encaminhamentos: 3 };
const volume = modeloDeVolume(TAMANHO);
const def = definicaoPdf(volume);

describe('definicaoPdf: página e estilo', () => {
  it('A4, margens de PAGINA_DOCUMENTO, título nos metadados, corpo em Inter', () => {
    expect(def.pageSize).toBe('A4');
    expect(def.pageMargins).toEqual([
      PAGINA_DOCUMENTO.margemPt,
      PAGINA_DOCUMENTO.margemPt,
      PAGINA_DOCUMENTO.margemPt,
      PAGINA_DOCUMENTO.margemInferiorPt,
    ]);
    expect(def.info?.title).toBe(volume.titulo);
    expect(def.defaultStyle).toMatchObject({
      font: 'Inter',
      fontSize: TIPOGRAFIA_DOCUMENTO.corpoPt,
      color: COR_TEXTO_DOCUMENTO,
    });
  });

  it('título centralizado em SourceSerif, no tamanho de título', () => {
    const titulo = [...objetos(def.content)].find(
      (o) => o.fontSize === TIPOGRAFIA_DOCUMENTO.tituloPt,
    );
    expect(achatar(titulo)).toBe(volume.titulo);
    expect(titulo?.alignment).toBe('center');
    expect([...objetos(titulo?.text)].every((t) => t.font === 'SourceSerif')).toBe(true);
  });

  it('subtítulos e títulos de seção marcados com headlineLevel 1', () => {
    const marcados = [...objetos(def.content)]
      .filter((o) => o.headlineLevel === 1)
      .map((o) => achatar(o));
    expect(marcados).toEqual(
      expect.arrayContaining(['Participantes', 'Pauta', 'Resumo', 'Decisões', 'Encaminhamentos']),
    );
  });
});

describe('definicaoPdf: tabelas', () => {
  it('encaminhamentos: cabeçalho repetido, linha que não se parte, larguras em %', () => {
    const { table, no } = tabelaComCabecalho(def, 'Ação');
    expect(table.headerRows).toBe(1);
    expect(table.dontBreakRows).toBe(true);
    expect(table.keepWithHeaderRows).toBe(1);
    expect(table.widths).toEqual(['50%', '20%', '15%', '15%']);
    expect(table.body).toHaveLength(1 + 3);
    expect(no.fontSize).toBe(TIPOGRAFIA_DOCUMENTO.tabelaPt);
  });

  it('participantes: larguras por peso da coluna (corporativa 43% · 29% · 28%)', () => {
    const { table } = tabelaComCabecalho(def, 'Presença');
    expect(table.widths).toEqual(['43%', '29%', '28%']);
    expect(table.body.map((linha) => achatar(linha[0]))).toContain('Łukasz Żółć');
  });

  it('tabela sem larguras → "*" em cada coluna; cabeçalho em negrito', () => {
    const sintetico: DocumentModel = {
      ...volume,
      blocos: [{ tipo: 'tabela', colunas: ['Item', 'Valor', 'Nota'], linhas: [['a', 'b', 'c']] }],
    };
    const { table, no } = tabelaComCabecalho(definicaoPdf(sintetico), 'Valor');
    expect(table.widths).toEqual(['*', '*', '*']);
    expect(table.headerRows).toBe(1);
    expect(table.dontBreakRows).toBe(true);
    expect(table.body[0]?.every((celula) => ehObj(celula) && celula.bold === true)).toBe(true);
    expect(no.layout).toBe('lightHorizontalLines');
  });
});

describe('definicaoPdf: logo', () => {
  it('sem logo, não há imagem nem o texto do espaço reservado da tela', () => {
    const json = JSON.stringify(def);
    expect(json).not.toContain('"image"');
    expect(json).not.toContain('Sua logo');
  });

  it('com logo, a imagem é a data URL e o tamanho nunca é ampliado (1 px → 0,75 pt)', () => {
    const imagens = [
      ...objetos(definicaoPdf(modeloDeVolume({ ...TAMANHO, logo: true })).content),
    ].filter((o) => 'image' in o);
    expect(imagens).toHaveLength(1);
    expect(imagens[0]).toMatchObject({ image: LOGO_TESTE.dataUrl, width: 0.75, height: 0.75 });
    expect(imagens[0]).not.toHaveProperty('fit');
  });

  it('logo grande cabe na caixa LOGO_CAIXA_PT mantendo a proporção', () => {
    const modelo: DocumentModel = {
      ...volume,
      cabecalho: { ...volume.cabecalho, logo: { ...LOGO_TESTE, largura: 1200, altura: 400 } },
    };
    const imagem = [...objetos(definicaoPdf(modelo).content)].find((o) => 'image' in o);
    expect(imagem).toMatchObject({ width: 144, height: 48 });
  });
});

describe('definicaoPdf: rodapés, lacunas, assinaturas e aviso', () => {
  it('footer(2, 7) = "Página 2 de 7", centralizado no tamanho de rodapé', () => {
    const footer = def.footer as (a: number, t: number, p: ContextPageSize) => unknown;
    const no = footer(2, 7, {} as ContextPageSize);
    expect(achatar(no)).toBe('Página 2 de 7');
    expect(no).toMatchObject({ alignment: 'center', fontSize: TIPOGRAFIA_DOCUMENTO.rodapePt });
  });

  it('o modelo tem rodapé interno, e ele não vai para o PDF', () => {
    expect(volume.rodapeInterno).not.toBeNull();
    expect(JSON.stringify(def)).not.toContain(volume.rodapeInterno);
    expect(JSON.stringify(def)).not.toContain('Minuta gerada com auxílio de IA');
  });

  it('[PREENCHER: local] sai em negrito com o fundo da lacuna', () => {
    const lacuna = [...objetos(def.content)].find((o) => o.text === '[PREENCHER: local]');
    expect(lacuna).toMatchObject({ bold: true, background: COR_FUNDO_PREENCHER });
  });

  it('assinaturas: duas por linha, cada uma inquebrável, com nome e papel', () => {
    const assinaturas = [...objetos(def.content)].filter(
      (o) => o.unbreakable === true && 'stack' in o,
    );
    expect(assinaturas.map(achatar)).toEqual(['Ana SouzaCondução', 'Bruno LimaRedação']);
    const linha = [...objetos(def.content)].find(
      (o) => Array.isArray(o.columns) && o.columns.some((c) => assinaturas.includes(c as Obj)),
    );
    expect(linha?.columns).toHaveLength(2);
  });

  it('aviso de minuta numa caixa, no tamanho de aviso', () => {
    const aviso = [...objetos(def.content)].find((o) => achatar(o) === AVISO_MINUTA && 'text' in o);
    expect(aviso?.fontSize).toBe(TIPOGRAFIA_DOCUMENTO.avisoPt);
    const caixa = tabelas(def).find(({ table }) => achatar(table.body[0]?.[0]) === AVISO_MINUTA);
    expect(caixa).toBeDefined();
  });
});

describe('definicaoPdf: título de seção não fica sozinho no pé da página', () => {
  const quebra = def.pageBreakBefore;
  const no = (n: Partial<Node>) => n as Node;
  const consultas = (seguintes: number, comRodape = false) =>
    ({
      getFollowingNodesOnPage: () => [
        ...Array.from({ length: seguintes }, () => no({})),
        // O pdfmake lista o rodapé entre os nós seguintes de toda página.
        ...(comRodape ? [no({ id: ID_NO_RODAPE })] : []),
      ],
    }) as unknown as NodeQueries;

  it('quebra antes do título que seria o último nó da página', () => {
    expect(quebra?.(no({ headlineLevel: 1 }), consultas(0))).toBe(true);
  });

  it('o rodapé da página não conta como nó que acompanha o título', () => {
    expect(quebra?.(no({ headlineLevel: 1 }), consultas(0, true))).toBe(true);
    expect(quebra?.(no({ headlineLevel: 1 }), consultas(1, true))).toBe(false);
  });

  it('o rodapé do documento carrega a marca que a conta ignora', () => {
    const rodape = def.footer;
    if (typeof rodape !== 'function') throw new Error('rodapé deveria ser função');
    expect(rodape(1, 2, { width: 595, height: 842, orientation: 'portrait' })).toMatchObject({
      id: ID_NO_RODAPE,
    });
  });

  it('não quebra se algo o acompanha na página, nem antes de nó que não é título', () => {
    expect(quebra?.(no({ headlineLevel: 1 }), consultas(1))).toBe(false);
    expect(quebra?.(no({}), consultas(0))).toBe(false);
  });
});
