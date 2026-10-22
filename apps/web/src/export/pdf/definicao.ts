import type {
  Content,
  CustomTableLayout,
  Node,
  NodeQueries,
  TableCell,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';
import {
  COR_FUNDO_PREENCHER,
  COR_TEXTO_DOCUMENTO,
  ESPACOS_DOCUMENTO,
  PAGINA_DOCUMENTO,
  TIPOGRAFIA_DOCUMENTO,
} from '../../config/documento';
import { dividirPreencher } from '../../document/build-model';
import { logoNoDocumentoPx, pxParaPt } from '../../document/medidas';
import type { DocBloco, DocumentModel, Inline } from '../../document/model';
import { partesDoRodape } from '../../document/rodape';
import { FONTES_PDF, separarPorFonte, type FamiliaPdf } from './cobertura';

/*
 * DocumentModel → definição declarativa do pdfmake. Puro e sem pdfmake em tempo de execução (só
 * `import type`): o renderizador é `gerar-pdf.ts`. Medidas e cores vêm de `config/documento.ts`.
 */

const T = TIPOGRAFIA_DOCUMENTO;
const E = ESPACOS_DOCUMENTO;

interface Trecho {
  text: string;
  font: string;
  bold?: boolean;
  background?: string;
  noWrap?: boolean;
}

/**
 * Palavra com hífen interno ("realizou-se", "1.080-A", "e-mail"), com o espaço ou a tabulação que
 * a segue: ficam no mesmo trecho para não abrir mais um ponto em que a justificação põe espaço
 * extra. Quebra de linha NÃO entra (sairia do trecho e a linha se perderia).
 */
const PALAVRA_COM_HIFEN = /\S+-\S+[ \t]*/g;

/**
 * Até quantos caracteres a palavra com hífen vai inteira (`noWrap`). O pdfmake nunca quebra um
 * trecho `noWrap` mais largo que a linha: um endereço comprido com hífens (plataforma, sistema)
 * passaria da margem. Acima disso, a palavra segue quebrável, como antes.
 */
export const HIFEN_INTEIRO_ATE_CARACTERES = 40;

/**
 * Separa as palavras com hífen do resto do texto. No texto justificado, o pdfmake abre ponto de
 * quebra depois do hífen seguido de letra e distribui a sobra da linha por trecho, não por espaço:
 * "realizou-" e "se" viravam dois trechos e ganhavam espaço entre eles ("realizou- se"). A palavra
 * inteira vai num trecho `noWrap`, que ele não divide. (O hífen inseparável U+2011 não serve: o
 * Inter embutido não o desenha.)
 */
function semQuebraNoHifen(texto: string): { texto: string; inteira: boolean }[] {
  const pedacos: { texto: string; inteira: boolean }[] = [];
  let inicio = 0;
  for (const achado of texto.matchAll(PALAVRA_COM_HIFEN)) {
    if (achado.index > inicio)
      pedacos.push({ texto: texto.slice(inicio, achado.index), inteira: false });
    pedacos.push({
      texto: achado[0],
      inteira: achado[0].trimEnd().length <= HIFEN_INTEIRO_ATE_CARACTERES,
    });
    inicio = achado.index + achado[0].length;
  }
  if (inicio < texto.length) pedacos.push({ texto: texto.slice(inicio), inteira: false });
  return pedacos;
}

/**
 * Partes do texto → trechos com a fonte certa; a lacuna `[PREENCHER]` em negrito com fundo. Com
 * `hifenInteiro` (parágrafo justificado), a palavra com hífen não se parte (`semQuebraNoHifen`).
 */
function trechos(partes: Inline[], familia: FamiliaPdf = 'corpo', hifenInteiro = false): Trecho[] {
  return partes.flatMap((parte) =>
    (hifenInteiro ? semQuebraNoHifen(parte.texto) : [{ texto: parte.texto, inteira: false }])
      .flatMap(({ texto, inteira }) =>
        separarPorFonte(texto, familia).map((t): Trecho => (inteira ? { ...t, noWrap: true } : t)),
      )
      .map((t) =>
        parte.destaque === 'preencher' ? { ...t, bold: true, background: COR_FUNDO_PREENCHER } : t,
      ),
  );
}

/** Texto solto (célula, linha do cabeçalho, assinatura, aviso), que também pode ter lacuna. */
const texto = (s: string): Trecho[] => trechos(dividirPreencher(s));

/** Subtítulo ou título de seção: serifado e marcado para não ficar sozinho no pé da página. */
function tituloDeSecao(s: string, fontSize: number): Content {
  return {
    text: separarPorFonte(s, 'titulo'),
    fontSize,
    headlineLevel: 1,
    margin: [0, E.antesDeSecaoPt, 0, E.aposSecaoPt],
  };
}

function tituloDaAta(s: string): Content {
  return {
    text: separarPorFonte(s, 'titulo'),
    fontSize: T.tituloPt,
    alignment: 'center',
    margin: [0, 0, 0, E.aposTituloPt],
  };
}

/** Timbre da 1ª página: logo (se houver, nunca ampliada) e as linhas do cabeçalho à direita. */
function timbre(cabecalho: DocumentModel['cabecalho']): Content[] {
  const linhas: Content = {
    stack: cabecalho.linhas.map((l) => ({ text: texto(l) })),
    fontSize: T.cabecalhoPt,
    alignment: 'right',
  };
  const { logo } = cabecalho;
  if (logo) {
    const px = logoNoDocumentoPx(logo);
    return [
      {
        columns: [
          { image: logo.dataUrl, width: pxParaPt(px.largura), height: pxParaPt(px.altura) },
          { ...linhas, width: '*' },
        ],
        columnGap: E.entreLogoECabecalhoPt,
        margin: [0, 0, 0, E.aposTimbrePt],
      },
    ];
  }
  if (cabecalho.linhas.length === 0) return [];
  return [{ ...linhas, margin: [0, 0, 0, E.aposTimbrePt] }];
}

function tabela(bloco: Extract<DocBloco, { tipo: 'tabela' }>): Content {
  const cabecalho: TableCell[] = bloco.colunas.map((c) => ({ text: texto(c), bold: true }));
  const linhas: TableCell[][] = bloco.linhas.map((linha) => linha.map((c) => ({ text: texto(c) })));
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      keepWithHeaderRows: 1,
      widths: bloco.larguras
        ? bloco.larguras.map((l) => `${String(l)}%`)
        : bloco.colunas.map(() => '*'),
      body: [cabecalho, ...linhas],
    },
    layout: 'lightHorizontalLines',
    fontSize: T.tabelaPt,
    margin: [0, 0, 0, E.aposBlocoPt],
  };
}

/** Só a linha de cima, fina: o traço da assinatura. */
const LAYOUT_LINHA_ASSINATURA: CustomTableLayout = {
  hLineWidth: (i) => (i === 0 ? E.linhaAssinaturaPt : 0),
  vLineWidth: () => 0,
  hLineColor: () => COR_TEXTO_DOCUMENTO,
  paddingLeft: () => 0,
  paddingRight: () => 0,
  paddingTop: () => 0,
  paddingBottom: () => 0,
};

/** Caixa de borda fina do aviso de minuta. */
const LAYOUT_CAIXA_FINA: CustomTableLayout = {
  hLineWidth: () => E.bordaFinaPt,
  vLineWidth: () => E.bordaFinaPt,
  hLineColor: () => COR_TEXTO_DOCUMENTO,
  vLineColor: () => COR_TEXTO_DOCUMENTO,
  paddingLeft: () => E.respiroDoAvisoPt,
  paddingRight: () => E.respiroDoAvisoPt,
  paddingTop: () => E.respiroDoAvisoPt,
  paddingBottom: () => E.respiroDoAvisoPt,
};

/** Uma assinatura: espaço para assinar, traço, nome e papel — nunca partida entre páginas. */
function assinatura(pessoa: { nome: string; papel: string }): Content {
  return {
    stack: [
      {
        table: { widths: ['*'], body: [[{ text: '' }]] },
        layout: LAYOUT_LINHA_ASSINATURA,
        margin: [0, E.espacoParaAssinarPt, 0, 0],
      },
      { text: texto(pessoa.nome), bold: true, alignment: 'center' },
      { text: texto(pessoa.papel), alignment: 'center' },
    ],
    unbreakable: true,
  };
}

/** Assinaturas duas por linha (a última sozinha ocupa a metade esquerda). */
function assinaturas(pessoas: { nome: string; papel: string }[]): Content[] {
  const linhas: Content[] = [];
  for (let i = 0; i < pessoas.length; i += 2) {
    const par = pessoas.slice(i, i + 2).map(assinatura);
    linhas.push({
      columns: par.length === 2 ? par : [...par, { text: '' }],
      columnGap: E.entreAssinaturasPt,
      unbreakable: true,
      margin: [0, 0, 0, E.aposBlocoPt],
    });
  }
  return linhas;
}

function aviso(s: string): Content {
  return {
    table: { widths: ['*'], body: [[{ text: texto(s), fontSize: T.avisoPt }]] },
    layout: LAYOUT_CAIXA_FINA,
    margin: [0, E.aposBlocoPt, 0, 0],
  };
}

function blocoPdf(bloco: DocBloco): Content[] {
  switch (bloco.tipo) {
    case 'titulo':
      return [tituloDaAta(bloco.texto)];
    case 'subtitulo':
      return [tituloDeSecao(bloco.texto, T.subtituloPt)];
    case 'paragrafo':
      return [
        {
          text: trechos(bloco.partes, 'corpo', true),
          alignment: 'justify',
          margin: [0, 0, 0, E.aposBlocoPt],
        },
      ];
    case 'lista':
      return [
        {
          ul: bloco.itens.map((item) => ({
            text: trechos(item),
            margin: [0, 0, 0, E.entreItensPt],
          })),
          margin: [0, 0, 0, E.aposBlocoPt],
        },
      ];
    case 'secao':
      // Achatada: o título fica no mesmo nível dos blocos seguintes, para `pageBreakBefore` ver o
      // que vem depois dele na página.
      return [tituloDeSecao(bloco.titulo, T.secaoPt), ...bloco.blocos.flatMap(blocoPdf)];
    case 'tabela':
      return [tabela(bloco)];
    case 'assinaturas':
      return assinaturas(bloco.pessoas);
    case 'aviso':
      return [aviso(bloco.texto)];
  }
}

/** "Página {pagina} de {total}" com os números da página. */
function textoDoRodape(modelo: string, atual: number, total: number): string {
  return partesDoRodape(modelo)
    .map((p) => (p.tipo === 'texto' ? p.texto : String(p.tipo === 'pagina' ? atual : total)))
    .join('');
}

/**
 * Marca do nó do rodapé. O pdfmake põe o rodapé na lista de nós de cada página: sem tirá-lo da
 * conta, todo título teria "um nó seguinte" (o próprio rodapé) e a quebra nunca dispararia.
 */
export const ID_NO_RODAPE = 'rodape-da-pagina';

/** Quebra antes de um título que seria o último nó de conteúdo da página (título órfão no pé). */
function quebraAntesDeTituloOrfao(no: Node, nos: NodeQueries): boolean {
  return (
    no.headlineLevel === 1 &&
    nos.getFollowingNodesOnPage().filter((seguinte) => seguinte.id !== ID_NO_RODAPE).length === 0
  );
}

/**
 * Definição do PDF da ata: A4, timbre só na 1ª página, título serifado, tabelas com cabeçalho
 * repetido e linhas inteiras, assinaturas inquebráveis, aviso de minuta em caixa e "Página X de Y"
 * em toda página. O `rodapeInterno` (provedores de IA) fica só na tela.
 */
export function definicaoPdf(modelo: DocumentModel): TDocumentDefinitions {
  const { margemPt, margemInferiorPt } = PAGINA_DOCUMENTO;
  return {
    pageSize: 'A4',
    pageMargins: [margemPt, margemPt, margemPt, margemInferiorPt],
    info: { title: modelo.titulo },
    defaultStyle: {
      font: FONTES_PDF.corpo.latin,
      fontSize: T.corpoPt,
      color: COR_TEXTO_DOCUMENTO,
    },
    content: [
      ...timbre(modelo.cabecalho),
      tituloDaAta(modelo.titulo),
      ...modelo.blocos.flatMap(blocoPdf),
    ],
    footer: (atual, total) => ({
      id: ID_NO_RODAPE,
      text: separarPorFonte(textoDoRodape(modelo.rodape, atual, total), 'corpo'),
      alignment: 'center',
      fontSize: T.rodapePt,
      margin: [margemPt, E.rodapeTopoPt, margemPt, 0],
    }),
    pageBreakBefore: quebraAntesDeTituloOrfao,
  };
}
