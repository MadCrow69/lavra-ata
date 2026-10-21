// @vitest-environment node
import { JSDOM } from 'jsdom';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AVISO_MINUTA, RODAPE_INTERNO_IA } from '../../config/documento';
import type { DocBloco, DocumentModel } from '../../document/model';
import { modeloDeVolume, NOME_DECOMPOSTO, NOME_LATIN_EXT } from '../../test/documento-volume';
import { xmlDoDocx } from '../../test/docx-xml';
import { TEMPO_VOLUME_MS } from '../../test/tempos';
import { gerarDocx } from './gerar-docx';

const NOME_ESPECIAL = '<script>&';

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
    const xml = await documentoDe(
      comParagrafo(modelo, `Ação de João — ${NOME_LATIN_EXT}, Ж${cp(0x1f600)}`),
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

  it('tabelas: cabeçalho repetido, linha que não parte e layout fixo', () => {
    expect(ocorrencias(documento, '<w:tblHeader/>')).toBeGreaterThanOrEqual(2);
    expect(ocorrencias(documento, '<w:cantSplit/>')).toBeGreaterThanOrEqual(400);
    expect(documento).toContain('<w:tblLayout w:type="fixed"/>');
  });

  it('a tabela de encaminhamentos tem a grade 4833/1933/1450/1450', () => {
    const grade = [4833, 1933, 1450, 1450].map((w) => `<w:gridCol w:w="${String(w)}"/>`).join('');
    expect(documento).toContain(`<w:tblGrid>${grade}</w:tblGrid>`);
  });

  it('rodapé "Página X de Y" com os campos PAGE e NUMPAGES', () => {
    const rodapes = [...partes].filter(([c]) => /^word\/footer\d*\.xml$/.test(c));
    expect(rodapes.length).toBeGreaterThan(0);
    const xml = rodapes.map(([, x]) => x).join('\n');
    expect(xml).toContain('Página ');
    expect(xml).toContain(' de ');
    expect(xml).toContain('PAGE');
    expect(xml).toContain('NUMPAGES');
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

  it('sem logo não há word/media', async () => {
    const partes = await xmlDoDocx(await gerarDocx(pequeno()));
    expect([...partes.keys()].some((c) => c.startsWith('word/media/'))).toBe(false);
  });

  it('logo com data URL ilegível falha com mensagem própria, sem texto de biblioteca', async () => {
    const base = pequeno(true);
    const logo = { dataUrl: 'data:image/png;base64,@@@', largura: 10, altura: 10 };
    const ruim: DocumentModel = { ...base, cabecalho: { ...base.cabecalho, logo } };
    await expect(gerarDocx(ruim)).rejects.toThrow('logo');
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
