// @vitest-environment node
import { JSDOM } from 'jsdom';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  AVISO_MINUTA,
  COR_TEXTO_DOCUMENTO,
  LINHAS_TABELA,
  RODAPE_INTERNO_IA,
} from '../../config/documento';
import { logoNoDocumentoPx } from '../../document/medidas';
import type { DocBloco, DocumentModel } from '../../document/model';
import {
  LOGO_TESTE,
  modeloDeVolume,
  NOME_DECOMPOSTO,
  NOME_LATIN_EXT,
} from '../../test/documento-volume';
import { xmlDoDocx } from '../../test/docx-xml';
import { TEMPO_VOLUME_MS } from '../../test/tempos';
import { gerarDocx } from './gerar-docx';

const NOME_ESPECIAL = '<script>&';

/** EMUs por pixel (a 96 px/pol.): o Word guarda o tamanho da imagem em EMUs. */
const EMU_POR_PX = 9525;

const MENSAGEM_LOGO_ILEGIVEL = 'A logo não pôde ser lida para o documento.';

const cp = (...pontos: number[]) => String.fromCodePoint(...pontos);

const ocorrencias = (xml: string, trecho: string) => xml.split(trecho).length - 1;

/** Acrescenta uma linha na primeira tabela do modelo (a de participantes). */
function comParticipante(modelo: DocumentModel, nome: string): DocumentModel {
  let feito = false;
  const trocar = (b: DocBloco): DocBloco => {
    if (b.tipo === 'secao') return { ...b, blocos: b.blocos.map(trocar) };
    if (b.tipo !== 'tabela' || feito) return b;
    feito = true;
    const nova = b.colunas.map((_, i) => (i === 0 ? nome : 'Cargo'));
    return { ...b, linhas: [...b.linhas, nova] };
  };
  return { ...modelo, blocos: modelo.blocos.map(trocar) };
}

function comParagrafo(modelo: DocumentModel, texto: string): DocumentModel {
  return { ...modelo, blocos: [...modelo.blocos, { tipo: 'paragrafo', partes: [{ texto }] }] };
}

function xmlValido(xml: string): boolean {
  const { DOMParser } = new JSDOM().window;
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return doc.getElementsByTagName('parsererror').length === 0;
}

/** Quantas tabelas de dados (com cabeçalho) o modelo tem, incluindo as dentro de seções. */
function tabelasDoModelo(blocos: readonly DocBloco[]): number {
  return blocos.reduce(
    (n, b) =>
      n + (b.tipo === 'tabela' ? 1 : 0) + (b.tipo === 'secao' ? tabelasDoModelo(b.blocos) : 0),
    0,
  );
}

const todos = (partes: Map<string, string>) => [...partes.values()].join('\n');

/** XML de `word/document.xml` do modelo. */
async function documentoDe(modelo: DocumentModel): Promise<string> {
  return (await xmlDoDocx(await gerarDocx(modelo))).get('word/document.xml') ?? '';
}

const paragrafos = (xml: string) => [...xml.matchAll(/<w:p>.*?<\/w:p>/gs)].map((m) => m[0]);

describe('gerarDocx · ata de volume com logo', () => {
  const fetchEspiao = vi.fn<typeof fetch>();
  let modelo: DocumentModel;
  let partes: Map<string, string>;
  let blob: Blob;
  let duracaoMs: number;
  let documento: string;

  beforeAll(async () => {
    vi.stubGlobal('fetch', fetchEspiao);
    modelo = comParticipante(
      modeloDeVolume({ participantes: 200, encaminhamentos: 200, logo: true }),
      NOME_ESPECIAL,
    );
    const inicio = performance.now();
    blob = await gerarDocx(modelo);
    duracaoMs = performance.now() - inicio;
    partes = await xmlDoDocx(blob);
    documento = partes.get('word/document.xml') ?? '';
  }, 60_000);

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('devolve um .docx (zip) com o tipo MIME do Word', () => {
    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(partes.has('[Content_Types].xml')).toBe(true);
    expect(documento).not.toBe('');
  });

  it('mostra acento, latin-ext, cirílico e emoji sem depender de fonte embutida', async () => {
    const pequeno = modeloDeVolume({ participantes: 1, encaminhamentos: 1 });
    const xml = await documentoDe(
      comParagrafo(pequeno, `Ação de João — ${NOME_LATIN_EXT}, Ж${cp(0x1f600)}`),
    );
    for (const trecho of ['Ação', 'João', 'Łukasz Żółć', `Ж${cp(0x1f600)}`]) {
      expect(xml).toContain(trecho);
    }
  });

  it('normaliza o texto em NFC (nome colado decomposto sai composto)', () => {
    expect(NOME_DECOMPOSTO).not.toBe(NOME_DECOMPOSTO.normalize('NFC'));
    expect(documento).toContain('João Decomposto');
    expect(documento).not.toContain(NOME_DECOMPOSTO);
  });

  it('escapa o texto da pessoa e o XML continua válido', () => {
    expect(documento).toContain('&lt;script&gt;&amp;');
    expect(documento).not.toContain('<script>');
    for (const [caminho, xml] of partes) {
      if (caminho.endsWith('.xml') || caminho.endsWith('.rels')) {
        expect(xmlValido(xml), caminho).toBe(true);
      }
    }
  });

  it('tabelas: layout fixo e linha que não parte', () => {
    expect(ocorrencias(documento, '<w:cantSplit/>')).toBeGreaterThanOrEqual(400);
    expect(documento).toContain('<w:tblLayout w:type="fixed"/>');
  });

  it('cada tabela de dados tem exatamente um cabeçalho repetido, na primeira linha', () => {
    const esperadas = tabelasDoModelo(modelo.blocos);
    expect(esperadas).toBe(2);
    const tabelas = [...documento.matchAll(/<w:tbl>.*?<\/w:tbl>/gs)].map((m) => m[0]);
    const deDados = tabelas.filter((t) => t.includes('<w:tblHeader/>'));
    expect(ocorrencias(documento, '<w:tblHeader/>')).toBe(esperadas);
    expect(deDados).toHaveLength(esperadas);
    for (const t of deDados) {
      const linhas = t.split('<w:tr>').slice(1);
      expect(linhas[0]).toContain('<w:tblHeader/>');
      expect(linhas.slice(1).every((l) => !l.includes('<w:tblHeader/>'))).toBe(true);
    }
  });

  it('a tabela logo após o título "Encaminhamentos" tem a grade 4833/1933/1450/1450', () => {
    const titulo = paragrafos(documento).find(
      (p) => p.includes('<w:pStyle w:val="Heading1"/>') && p.includes('>Encaminhamentos<'),
    );
    expect(titulo, 'título de seção "Encaminhamentos"').toBeDefined();
    const depois = documento.slice(documento.indexOf(titulo ?? '?'));
    const grade = /<w:tblGrid>(.*?)<\/w:tblGrid>/s.exec(depois)?.[1];
    const esperado = [4833, 1933, 1450, 1450]
      .map((w) => `<w:gridCol w:w="${String(w)}"/>`)
      .join('');
    expect(grade).toBe(esperado);
  });

  it('rodapé "Página X de Y" com os campos PAGE e NUMPAGES, nessa ordem', () => {
    const rodapes = [...partes].filter(([c]) => /^word\/footer\d*\.xml$/.test(c));
    expect(rodapes.length).toBeGreaterThan(0);
    const xml = rodapes.map(([, x]) => x).join('\n');
    const campos = [...xml.matchAll(/<w:instrText[^>]*>\s*([A-Z]+)\s*<\/w:instrText>/g)].map(
      (m) => m[1],
    );
    expect(campos).toEqual(['PAGE', 'NUMPAGES']);
    expect(xml).toContain('Página ');
    expect(xml).toContain(' de ');
    expect(xml.indexOf('Página ')).toBeLessThan(xml.indexOf('>PAGE<'));
    expect(xml.indexOf('>PAGE<')).toBeLessThan(xml.indexOf(' de '));
    expect(xml.indexOf(' de ')).toBeLessThan(xml.indexOf('>NUMPAGES<'));
  });

  it('títulos de seção ficam com o que vem depois (keepNext)', () => {
    const titulo = paragrafos(documento).find((p) => p.includes('>Resumo<'));
    expect(titulo, 'parágrafo do título "Resumo"').toBeDefined();
    expect(titulo).toContain('<w:keepNext/>');
    expect(titulo).toContain('<w:keepLines/>');
  });

  it('traz o aviso de minuta em parágrafo com borda', () => {
    const aviso = paragrafos(documento).find((p) => p.includes(AVISO_MINUTA));
    expect(aviso).toBeDefined();
    expect(aviso).toContain('<w:pBdr>');
  });

  it('a lacuna [PREENCHER] sai em negrito com o fundo da folha', () => {
    const lacuna = [...documento.matchAll(/<w:r>.*?<\/w:r>/gs)].find((m) =>
      m[0].includes('[PREENCHER: local]'),
    )?.[0];
    expect(lacuna).toContain('<w:b/>');
    expect(lacuna).toMatch(/<w:shd [^>]*w:fill="fbebd9"/);
  });

  it('assinaturas: o nome leva a linha acima e fica unido ao papel por keepNext', () => {
    const bloco = modelo.blocos.find((b) => b.tipo === 'assinaturas');
    expect(bloco?.tipo).toBe('assinaturas');
    if (bloco?.tipo !== 'assinaturas') return;
    const pessoa = bloco.pessoas[0];
    const nome = paragrafos(documento).find(
      (p) => p.includes('<w:pBdr>') && p.includes(`>${pessoa?.nome ?? '?'}<`),
    );
    expect(nome, 'parágrafo do nome, com a linha de assinatura').toBeDefined();
    expect(nome).toContain('<w:keepNext/>');
    expect(nome).toMatch(/<w:pBdr><w:top /);
    expect(paragrafos(documento).some((p) => p.includes(pessoa?.papel ?? '?'))).toBe(true);
  });

  it('o modelo tem rodapeInterno, mas nenhum arquivo do .docx o contém', () => {
    expect(modelo.rodapeInterno).toContain(RODAPE_INTERNO_IA);
    expect(todos(partes)).not.toContain(RODAPE_INTERNO_IA);
    expect(todos(partes)).not.toContain(modelo.rodapeInterno ?? '?');
  });

  it('com logo há uma imagem PNG em word/media', () => {
    const midia = [...partes.keys()].filter((c) => c.startsWith('word/media/'));
    expect(midia.length).toBeGreaterThan(0);
    expect(midia.every((c) => c.endsWith('.png'))).toBe(true);
  });

  it('a logo pequena não é ampliada: a imagem mede os pixels da logo', () => {
    const px = logoNoDocumentoPx(LOGO_TESTE);
    expect(px).toEqual({ largura: LOGO_TESTE.largura, altura: LOGO_TESTE.altura });
    expect(documento).toContain(
      `<wp:extent cx="${String(px.largura * EMU_POR_PX)}" cy="${String(px.altura * EMU_POR_PX)}"/>`,
    );
  });

  it('metadados: título da ata e nenhum autor (o documento é da pessoa)', () => {
    const nucleo = partes.get('docProps/core.xml') ?? '';
    expect(nucleo).toContain('<dc:title>');
    expect(nucleo).not.toMatch(/<dc:creator>[^<]+/);
    expect(nucleo).not.toMatch(/<cp:lastModifiedBy>[^<]+/);
    expect(nucleo).not.toContain('Un-named');
  });

  it('não faz nenhuma requisição de rede', () => {
    expect(fetchEspiao).not.toHaveBeenCalled();
  });

  it('200 participantes e 200 encaminhamentos saem em tempo razoável', () => {
    expect(duracaoMs).toBeLessThan(TEMPO_VOLUME_MS);
  });
});

describe('gerarDocx · casos de borda', () => {
  const pequeno = (logo = false) => modeloDeVolume({ participantes: 2, encaminhamentos: 2, logo });

  it('logo maior que a caixa é reduzida, mantendo a proporção', async () => {
    const base = pequeno(true);
    const grande = { ...LOGO_TESTE, largura: 1200, altura: 300 };
    const px = logoNoDocumentoPx(grande);
    expect(px.largura).toBeLessThan(grande.largura);
    const xml = await documentoDe({ ...base, cabecalho: { ...base.cabecalho, logo: grande } });
    expect(xml).toContain(
      `<wp:extent cx="${String(px.largura * EMU_POR_PX)}" cy="${String(px.altura * EMU_POR_PX)}"/>`,
    );
  });

  it('sem logo não há word/media', async () => {
    const partes = await xmlDoDocx(await gerarDocx(pequeno()));
    expect([...partes.keys()].some((c) => c.startsWith('word/media/'))).toBe(false);
  });

  it('logo com data URL ilegível falha com mensagem própria, sem texto de biblioteca', async () => {
    const base = pequeno(true);
    const logo = { dataUrl: 'data:image/png;base64,@@@', largura: 10, altura: 10 };
    const ruim: DocumentModel = { ...base, cabecalho: { ...base.cabecalho, logo } };
    await expect(gerarDocx(ruim)).rejects.toMatchObject({ message: MENSAGEM_LOGO_ILEGIVEL });
  });

  it('caractere inválido em XML (controle, substituto solto) é removido', async () => {
    const xml = await documentoDe(
      comParagrafo(pequeno(), `Antes${cp(0)}${cp(0x0b)}${cp(0xd800)}depois`),
    );
    expect(xml).toContain('Antesdepois');
    expect(xmlValido(xml)).toBe(true);
  });

  it('quebra de linha no texto vira quebra no Word', async () => {
    const xml = await documentoDe(comParagrafo(pequeno(), 'linha 1\nlinha 2'));
    expect(xml).toContain('<w:br/>');
  });

  it('ata ainda sem seções (só o título) também gera', async () => {
    const vazio: DocumentModel = { ...pequeno(), blocos: [], rodapeInterno: null };
    expect(xmlValido(await documentoDe(vazio))).toBe(true);
  });

  it('o corpo termina em parágrafo, mesmo quando o último bloco é uma tabela', async () => {
    const base = pequeno();
    const tabela = base.blocos.find((b) => b.tipo === 'tabela');
    expect(tabela).toBeDefined();
    const xml = await documentoDe({ ...base, blocos: tabela ? [tabela] : [] });
    const corpo = /<w:body>(.*)<\/w:body>/s.exec(xml)?.[1] ?? '';
    const semSecao = corpo.replace(/<w:sectPr>.*<\/w:sectPr>\s*$/s, '');
    expect(semSecao.trimEnd().endsWith('</w:p>')).toBe(true);
  });
});

describe('gerarDocx · cor de destaque', () => {
  const semHash = (cor: string) => cor.replace(/^#/, '');
  const TINTA = semHash(COR_TEXTO_DOCUMENTO).toUpperCase();

  /** Valores de todo `w:color w:val` dos arquivos, em maiúsculas (o XML pode vir em qualquer caixa). */
  const coresEm = (...xmls: string[]) =>
    xmls.flatMap((xml) =>
      [...xml.matchAll(/<w:color w:val="([^"]+)"/g)].map((m) => (m[1] ?? '').toUpperCase()),
    );

  const estilo = (styles: string, id: string) =>
    new RegExp(`<w:style [^>]*w:styleId="${id}".*?</w:style>`, 's').exec(styles)?.[0] ?? '';

  it('com o padrão, só a tinta, "auto" e a linha da tabela aparecem (saída idêntica à de antes)', async () => {
    const partes = await xmlDoDocx(
      await gerarDocx(modeloDeVolume({ participantes: 3, encaminhamentos: 3 })),
    );
    const styles = partes.get('word/styles.xml') ?? '';
    // A biblioteca traz estilos que o documento não usa (Heading3.., Hyperlink) com cores próprias.
    const usados = styles.replace(
      /<w:style [^>]*w:styleId="(?!Title"|Heading1"|Heading2")[^"]*".*?<\/w:style>/gs,
      '',
    );
    const cores = coresEm(partes.get('word/document.xml') ?? '', usados);
    const permitidas = new Set([TINTA, 'AUTO', semHash(LINHAS_TABELA.corPadrao).toUpperCase()]);
    expect(cores.length).toBeGreaterThan(0);
    expect(cores.filter((c) => !permitidas.has(c))).toEqual([]);
    for (const id of ['Title', 'Heading1', 'Heading2'])
      expect(coresEm(estilo(styles, id)), id).toEqual([TINTA]);
  });

  it('com Vinho, Title, Heading1 e Heading2 levam a cor e o estilo padrão segue na tinta', async () => {
    const modelo = {
      ...modeloDeVolume({ participantes: 3, encaminhamentos: 3 }),
      corDestaque: '#7b1e3a',
    };
    const partes = await xmlDoDocx(await gerarDocx(modelo));
    const styles = partes.get('word/styles.xml') ?? '';
    for (const id of ['Title', 'Heading1', 'Heading2']) {
      expect(coresEm(estilo(styles, id)), id).toEqual(['7B1E3A']);
    }
    const padrao = /<w:docDefaults>.*?<\/w:docDefaults>/s.exec(styles)?.[0] ?? '';
    expect(coresEm(padrao)).toEqual([TINTA]);
    expect(coresEm(partes.get('word/document.xml') ?? '')).not.toContain('7B1E3A');
  });
});
