import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  LineRuleType,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
  type FileChild,
  type IBorderOptions,
  type ITableBordersOptions,
} from 'docx';
import {
  COR_FUNDO_PREENCHER,
  COR_TEXTO_DOCUMENTO,
  ESPACOS_DOCX,
  ESPACOS_PDF,
  FONTES_DOCX,
  LINHAS_TABELA,
  PAGINA_DOCUMENTO,
  TIPOGRAFIA_DOCUMENTO,
} from '../../config/documento';
import { dividirPreencher } from '../../document/build-model';
import { bytesDeDataUrl } from '../../document/data-url';
import { logoNoDocumentoPx, pxParaPt } from '../../document/medidas';
import type { DocBloco, DocumentModel, Inline, LogoDoc } from '../../document/model';
import { partesDoRodape } from '../../document/rodape';
import { A4_DXA, larguraUtilDxa, largurasDxa, ptParaDxa } from './medidas-docx';

/*
 * DocumentModel → .docx editável, no navegador. Entra SÓ por `import()` dinâmico (Task 8): a
 * biblioteca `docx` fica num chunk próprio. Espelha `export/pdf/definicao.ts` (mesmas seções,
 * tabelas, assinaturas, aviso de minuta e logo); o `rodapeInterno` fica só na tela. Medidas, cores
 * e fontes vêm de `config/documento.ts`; nada é embutido: o Word resolve Cambria e Calibri no
 * computador de quem abre.
 */

const T = TIPOGRAFIA_DOCUMENTO;
const E = ESPACOS_PDF;
const D = ESPACOS_DOCX;

/** Referência da numeração de marcadores das listas. */
const REFERENCIA_LISTA = 'lista';

/** Eixos dos tamanhos: o Word mede a fonte em meios-pontos e a borda em oitavos de ponto. */
const meioPonto = (pt: number): number => Math.round(pt * 2);
const oitavoDePonto = (pt: number): number => Math.round(pt * 8);

/** O Word quer a cor em hexadecimal sem `#`. */
const semHash = (cor: string): string => cor.replace(/^#/, '');
const COR_TEXTO = semHash(COR_TEXTO_DOCUMENTO);
const COR_PREENCHER = semHash(COR_FUNDO_PREENCHER);

/** Caractere que o XML 1.0 aceita (controles e substitutos soltos deixariam o arquivo corrompido). */
function caractereDeXml(ponto: number): boolean {
  return (
    ponto === 0x09 ||
    ponto === 0x0a ||
    ponto === 0x0d ||
    (ponto >= 0x20 && ponto <= 0xd7ff) ||
    (ponto >= 0xe000 && ponto <= 0xfffd) ||
    (ponto >= 0x10000 && ponto <= 0x10ffff)
  );
}

/** Texto do documento: NFC e só caracteres válidos em XML. Texto de IA/colado pode trazer lixo. */
function limpo(s: string): string {
  return Array.from(s.normalize('NFC'))
    .filter((c) => caractereDeXml(c.codePointAt(0) ?? 0))
    .join('');
}

interface Formato {
  negrito?: boolean;
  tamanhoPt?: number;
  fonte?: string;
  preencher?: boolean;
}

/** Corridas de um texto: uma por linha (a quebra vira `<w:br/>`), com o formato pedido. */
function corridas(s: string, formato: Formato = {}): TextRun[] {
  return s.split(/\r\n|\r|\n/).map(
    (linha, i) =>
      new TextRun({
        text: limpo(linha),
        ...(i > 0 ? { break: 1 } : {}),
        ...(formato.negrito === true ? { bold: true } : {}),
        ...(formato.tamanhoPt !== undefined ? { size: meioPonto(formato.tamanhoPt) } : {}),
        ...(formato.fonte !== undefined ? { font: formato.fonte } : {}),
        ...(formato.preencher === true
          ? { shading: { type: ShadingType.CLEAR, fill: COR_PREENCHER, color: 'auto' } }
          : {}),
      }),
  );
}

/** Partes do texto → corridas; a lacuna `[PREENCHER: …]` em negrito com o fundo da folha. */
function corridasDe(partes: readonly Inline[], base: Formato = {}): TextRun[] {
  return partes.flatMap((p) =>
    corridas(
      p.texto,
      p.destaque === 'preencher' ? { ...base, negrito: true, preencher: true } : base,
    ),
  );
}

/** Texto solto (célula, linha do cabeçalho, assinatura, aviso), que também pode ter lacuna. */
const corridasDeTexto = (s: string, base: Formato = {}): TextRun[] =>
  corridasDe(dividirPreencher(s), base);

/** Parágrafo vazio que só reserva espaço vertical (e separa tabelas vizinhas). */
function espaco(pt: number): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after: 0, line: ptParaDxa(pt), lineRule: LineRuleType.EXACT },
  });
}

const SEM_BORDA: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: 'auto' };

const BORDAS_NENHUMA: ITableBordersOptions = {
  top: SEM_BORDA,
  bottom: SEM_BORDA,
  left: SEM_BORDA,
  right: SEM_BORDA,
  insideHorizontal: SEM_BORDA,
  insideVertical: SEM_BORDA,
};

const MARGENS_ZERO = { top: 0, bottom: 0, left: 0, right: 0 };

/** Subtítulo ou título de seção: serifado e preso ao que vem depois (nunca sozinho no pé). */
function tituloDeSecao(s: string, nivel: 'secao' | 'subtitulo'): Paragraph {
  return new Paragraph({
    heading: nivel === 'secao' ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
    keepNext: true,
    keepLines: true,
    spacing: { before: ptParaDxa(E.antesDeSecaoPt), after: ptParaDxa(E.aposSecaoPt) },
    children: corridas(s),
  });
}

function tituloDaAta(s: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    keepNext: true,
    keepLines: true,
    spacing: { before: 0, after: ptParaDxa(E.aposTituloPt) },
    children: corridas(s),
  });
}

function imagemDaLogo(logo: LogoDoc): ImageRun {
  let dados: Uint8Array;
  try {
    dados = bytesDeDataUrl(logo.dataUrl);
  } catch {
    // Sem repassar o erro: texto de biblioteca/decodificação nunca vai para a tela.
    throw new Error('A logo não pôde ser lida para o documento.');
  }
  const px = logoNoDocumentoPx(logo);
  return new ImageRun({
    type: 'png',
    data: dados,
    transformation: { width: px.largura, height: px.altura },
    altText: { name: 'Logo', title: 'Logo', description: 'Logo da organização' },
  });
}

/** Linhas do cabeçalho, alinhadas à direita. */
function linhasDoCabecalho(linhas: readonly string[], aposPt: number): Paragraph[] {
  return linhas.map(
    (l, i) =>
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: i === linhas.length - 1 ? ptParaDxa(aposPt) : 0 },
        children: corridasDeTexto(l, { tamanhoPt: T.cabecalhoPt }),
      }),
  );
}

/** Timbre da 1ª página: logo (se houver, nunca ampliada) e as linhas do cabeçalho à direita. */
function timbre(cabecalho: DocumentModel['cabecalho']): FileChild[] {
  const { logo, linhas } = cabecalho;
  if (!logo) return linhasDoCabecalho(linhas, E.aposTimbrePt);

  const larguraDaLogo = ptParaDxa(pxParaPt(logoNoDocumentoPx(logo).largura));
  const colunaDaLogo = larguraDaLogo + ptParaDxa(E.entreLogoECabecalhoPt);
  const colunaDoTexto = larguraUtilDxa() - colunaDaLogo;
  return [
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: larguraUtilDxa(), type: WidthType.DXA },
      columnWidths: [colunaDaLogo, colunaDoTexto],
      borders: BORDAS_NENHUMA,
      margins: MARGENS_ZERO,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: colunaDaLogo, type: WidthType.DXA },
              children: [new Paragraph({ children: [imagemDaLogo(logo)] })],
            }),
            new TableCell({
              width: { size: colunaDoTexto, type: WidthType.DXA },
              children: linhas.length > 0 ? linhasDoCabecalho(linhas, 0) : [new Paragraph({})],
            }),
          ],
        }),
      ],
    }),
    espaco(E.aposTimbrePt),
  ];
}

const BORDAS_DE_DADOS: ITableBordersOptions = {
  ...BORDAS_NENHUMA,
  insideHorizontal: {
    style: BorderStyle.SINGLE,
    size: oitavoDePonto(LINHAS_TABELA.padraoPt),
    color: semHash(LINHAS_TABELA.corPadrao),
  },
};

/** Tabela de dados: layout fixo, cabeçalho em negrito que repete em cada página, linha inteira. */
function tabela(bloco: Extract<DocBloco, { tipo: 'tabela' }>): FileChild[] {
  const larguras = largurasDxa(bloco.larguras, bloco.colunas.length);
  const formato: Formato = { tamanhoPt: T.tabelaPt };
  const celula = (texto: string, i: number, cabecalho: boolean): TableCell =>
    new TableCell({
      width: { size: larguras[i] ?? 0, type: WidthType.DXA },
      ...(cabecalho
        ? {
            borders: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: oitavoDePonto(LINHAS_TABELA.cabecalhoPt),
                color: COR_TEXTO,
              },
            },
          }
        : {}),
      children: [
        new Paragraph({
          // O cabeçalho fica junto da primeira linha de dados.
          ...(cabecalho ? { keepNext: true } : {}),
          children: corridasDeTexto(texto, cabecalho ? { ...formato, negrito: true } : formato),
        }),
      ],
    });

  return [
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: larguraUtilDxa(), type: WidthType.DXA },
      columnWidths: larguras,
      borders: BORDAS_DE_DADOS,
      margins: {
        top: ptParaDxa(D.celulaVerticalPt),
        bottom: ptParaDxa(D.celulaVerticalPt),
        left: ptParaDxa(D.celulaHorizontalPt),
        right: ptParaDxa(D.celulaHorizontalPt),
      },
      rows: [
        new TableRow({
          tableHeader: true,
          cantSplit: true,
          children: bloco.colunas.map((c, i) => celula(c, i, true)),
        }),
        ...bloco.linhas.map(
          (linha) =>
            new TableRow({
              cantSplit: true,
              children: linha.map((c, i) => celula(c, i, false)),
            }),
        ),
      ],
    }),
    espaco(E.aposBlocoPt),
  ];
}

interface Pessoa {
  nome: string;
  papel: string;
}

/** Uma assinatura: espaço para assinar, traço, nome e papel; o traço é a borda de cima do nome. */
function assinatura(pessoa: Pessoa): Paragraph[] {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true,
      keepLines: true,
      spacing: { before: ptParaDxa(E.espacoParaAssinarPt), after: 0 },
      border: {
        top: {
          style: BorderStyle.SINGLE,
          size: oitavoDePonto(E.linhaAssinaturaPt),
          color: COR_TEXTO,
          space: 1,
        },
      },
      children: corridasDeTexto(pessoa.nome, { negrito: true }),
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepLines: true,
      children: corridasDeTexto(pessoa.papel),
    }),
  ];
}

/** Assinaturas duas por linha (a última sozinha ocupa a metade esquerda); cada linha é inteira. */
function assinaturas(pessoas: readonly Pessoa[]): FileChild[] {
  const entre = ptParaDxa(E.entreAssinaturasPt);
  const metade = Math.floor((larguraUtilDxa() - entre) / 2);
  const larguras = [metade, entre, larguraUtilDxa() - entre - metade];
  const celula = (i: number, filhos: Paragraph[]) =>
    new TableCell({ width: { size: larguras[i] ?? 0, type: WidthType.DXA }, children: filhos });

  const linhas: FileChild[] = [];
  for (let i = 0; i < pessoas.length; i += 2) {
    const [esquerda, direita] = [pessoas[i], pessoas[i + 1]];
    linhas.push(
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: larguraUtilDxa(), type: WidthType.DXA },
        columnWidths: larguras,
        borders: BORDAS_NENHUMA,
        margins: MARGENS_ZERO,
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              celula(0, esquerda ? assinatura(esquerda) : [new Paragraph({})]),
              celula(1, [new Paragraph({})]),
              celula(2, direita ? assinatura(direita) : [new Paragraph({})]),
            ],
          }),
        ],
      }),
      espaco(E.aposBlocoPt),
    );
  }
  return linhas;
}

/** Aviso de minuta: caixa de borda fina, com o respiro interno do PDF. */
function aviso(s: string): Paragraph {
  const borda: IBorderOptions = {
    style: BorderStyle.SINGLE,
    size: oitavoDePonto(E.bordaFinaPt),
    color: COR_TEXTO,
    space: E.respiroDoAvisoPt,
  };
  return new Paragraph({
    keepLines: true,
    spacing: { before: ptParaDxa(E.aposBlocoPt), after: 0 },
    // A borda do Word fica FORA do recuo; o recuo mantém a caixa dentro das margens.
    indent: { left: ptParaDxa(E.respiroDoAvisoPt), right: ptParaDxa(E.respiroDoAvisoPt) },
    border: { top: borda, bottom: borda, left: borda, right: borda },
    children: corridasDeTexto(s, { tamanhoPt: T.avisoPt }),
  });
}

function blocoDocx(bloco: DocBloco): FileChild[] {
  switch (bloco.tipo) {
    case 'titulo':
      return [tituloDaAta(bloco.texto)];
    case 'subtitulo':
      return [tituloDeSecao(bloco.texto, 'subtitulo')];
    case 'paragrafo':
      return [
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: ptParaDxa(E.aposBlocoPt) },
          children: corridasDe(bloco.partes),
        }),
      ];
    case 'lista':
      return bloco.itens.map(
        (item, i) =>
          new Paragraph({
            numbering: { reference: REFERENCIA_LISTA, level: 0 },
            spacing: {
              after: ptParaDxa(i === bloco.itens.length - 1 ? E.aposBlocoPt : E.entreItensPt),
            },
            children: corridasDe(item),
          }),
      );
    case 'secao':
      return [tituloDeSecao(bloco.titulo, 'secao'), ...bloco.blocos.flatMap(blocoDocx)];
    case 'tabela':
      return tabela(bloco);
    case 'assinaturas':
      return assinaturas(bloco.pessoas);
    case 'aviso':
      return [aviso(bloco.texto)];
  }
}

/** "Página {pagina} de {total}" com os campos de numeração do Word. */
function rodape(modelo: string): Footer {
  const filhos = partesDoRodape(modelo).map((p) => {
    if (p.tipo === 'texto') return limpo(p.texto);
    return p.tipo === 'pagina' ? PageNumber.CURRENT : PageNumber.TOTAL_PAGES;
  });
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ size: meioPonto(T.rodapePt), children: filhos })],
      }),
    ],
  });
}

/** Estilo dos títulos: serifado, na cor do texto e sem o azul/negrito padrão do Word. */
function estiloDeTitulo(tamanhoPt: number) {
  return {
    run: { font: FONTES_DOCX.titulo, size: meioPonto(tamanhoPt), bold: false, color: COR_TEXTO },
  };
}

/** Corpo do documento. Toda tabela é seguida de um parágrafo (o Word exige um no fim do corpo). */
const corpo = (modelo: DocumentModel): FileChild[] => [
  ...timbre(modelo.cabecalho),
  tituloDaAta(modelo.titulo),
  ...modelo.blocos.flatMap(blocoDocx),
];

/**
 * Gera o .docx da ata no navegador: A4, timbre só na 1ª página, título serifado, tabelas com
 * cabeçalho repetido e linhas inteiras, assinaturas e aviso de minuta, "Página X de Y" em toda
 * página. Sem autor nos metadados (o documento é da pessoa).
 */
export async function gerarDocx(modelo: DocumentModel): Promise<Blob> {
  const { margemPt, margemInferiorPt } = PAGINA_DOCUMENTO;
  const doc = new Document({
    title: limpo(modelo.titulo),
    creator: '',
    lastModifiedBy: '',
    styles: {
      default: {
        document: {
          run: {
            font: FONTES_DOCX.corpo,
            size: meioPonto(T.corpoPt),
            color: COR_TEXTO,
            language: { value: 'pt-BR' },
          },
        },
        title: estiloDeTitulo(T.tituloPt),
        heading1: estiloDeTitulo(T.secaoPt),
        heading2: estiloDeTitulo(T.subtituloPt),
      },
    },
    numbering: {
      config: [
        {
          reference: REFERENCIA_LISTA,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: {
                    left: ptParaDxa(D.recuoListaPt),
                    hanging: ptParaDxa(D.marcadorListaPt),
                  },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_DXA.largura, height: A4_DXA.altura },
            margin: {
              top: ptParaDxa(margemPt),
              right: ptParaDxa(margemPt),
              left: ptParaDxa(margemPt),
              bottom: ptParaDxa(margemInferiorPt),
              // Mesma posição do PDF: o texto do rodapé começa `rodapeTopoPt` abaixo do corpo.
              footer: ptParaDxa(margemInferiorPt - E.rodapeTopoPt - T.rodapePt),
            },
          },
        },
        footers: { default: rodape(modelo.rodape) },
        children: corpo(modelo),
      },
    ],
  });
  return Packer.toBlob(doc);
}
