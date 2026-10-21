// @vitest-environment node
import { extractText } from 'unpdf';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cipa } from '../ata-types/cipa';
import type { AtaTypeDefinition } from '../ata-types/types';
import type { DocumentModel } from '../document/model';
import { modeloDeVolume } from '../test/documento-volume';
import { xmlDoDocx } from '../test/docx-xml';
import { TEMPO_VOLUME_MS } from '../test/tempos';
import { gerarDocx } from './docx/gerar-docx';
import { larguraUtilDxa } from './docx/medidas-docx';
import { gerarPdf } from './pdf/gerar-pdf';

/**
 * PDF e DOCX de cada tipo formal com volume (as seções do próprio tipo): textos próprios do tipo
 * no PDF, grade da tabela de participantes somando a largura útil e o aviso final no DOCX. Os
 * Tasks seguintes acrescentam um caso por tipo.
 */
interface Caso {
  tipo: AtaTypeDefinition;
  dados: Record<string, string>;
  extras: (i: number) => Record<string, string>;
  /** Trechos que o PDF precisa trazer, além do título de cada seção do tipo. */
  noPdf: string[];
  /** Aviso final do tipo, conferido no `document.xml`. */
  aviso: string;
}

const CASOS: Caso[] = [
  {
    tipo: cipa,
    dados: {
      empresa: 'Empresa Exemplo Ltda.',
      estabelecimento: 'Unidade Centro',
      gestao: '2026/2027',
      numero: '3',
      natureza: 'ordinaria',
      data: '2026-10-14',
      inicio: '14:30',
      fim: '16:00',
      modalidade: 'hibrida',
      local: 'Sala de Treinamento 2',
      plataforma: 'Sala virtual da empresa',
      presidente: 'Carla Mendes',
      secretario: 'Diego Faria',
    },
    extras: (i) => ({ representacao: i % 2 ? 'empregados' : 'empregador', condicao: 'titular' }),
    noPdf: ['Comissão Interna de Prevenção de Acidentes e de Assédio', 'Representação', '5.6.3.2'],
    aviso: cipa.textosFixos?.avisoDisponibilizacao ?? 'aviso ausente',
  },
];

const espacos = (texto: string) => texto.replace(/\s+/g, ' ');

/** Único aviso aceito: o pdfmake no Node pede política de acesso local (no navegador não há). */
const AVISO_ACESSO_LOCAL = 'No local access policy defined.';

const paragrafos = (xml: string) => [...xml.matchAll(/<w:p>.*?<\/w:p>/gs)].map((m) => m[0]);

describe.each(CASOS)('exportação · $tipo.id com volume', (caso) => {
  let modelo: DocumentModel;
  let textoPdf: string;
  let documento: string;
  const avisosInesperados: unknown[][] = [];

  beforeAll(async () => {
    // Só o aviso do pdfmake no Node é aceito (ver gerar-pdf.test.ts); qualquer outro reprova.
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].startsWith(AVISO_ACESSO_LOCAL)) return;
      avisosInesperados.push(args);
    });
    modelo = modeloDeVolume({
      participantes: 12,
      encaminhamentos: 5,
      tipo: caso.tipo,
      dados: caso.dados,
      extras: caso.extras,
    });
    const pdf = new Uint8Array(await (await gerarPdf(modelo)).arrayBuffer());
    const { text } = await extractText(pdf.slice(), { mergePages: true });
    textoPdf = espacos(text);
    documento = (await xmlDoDocx(await gerarDocx(modelo))).get('word/document.xml') ?? '';
  }, TEMPO_VOLUME_MS);

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('o modelo usa as seções do próprio tipo', () => {
    const titulos = modelo.blocos.flatMap((b) => (b.tipo === 'secao' ? [b.titulo] : []));
    expect(titulos).toEqual([
      ...caso.tipo.secoes.map((s) => s.titulo),
      ...(caso.tipo.temEncaminhamentos ? ['Encaminhamentos'] : []),
    ]);
  });

  it('PDF traz os textos do tipo e o título de cada seção', () => {
    for (const trecho of [...caso.noPdf, ...caso.tipo.secoes.map((s) => s.titulo)]) {
      expect(textoPdf, trecho).toContain(trecho);
    }
    expect(avisosInesperados).toEqual([]);
  });

  it('DOCX: a grade da tabela de participantes soma a largura útil e o aviso final está no texto', () => {
    const subtitulo = paragrafos(documento).find((p) =>
      p.includes(`>${caso.tipo.rotulos.participantes}<`),
    );
    expect(subtitulo, 'subtítulo da tabela de participantes').toBeDefined();
    const depois = documento.slice(documento.indexOf(subtitulo ?? '?'));
    const grade = /<w:tblGrid>(.*?)<\/w:tblGrid>/s.exec(depois)?.[1] ?? '';
    const larguras = [...grade.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map((m) => Number(m[1]));
    expect(larguras).toHaveLength(
      modelo.blocos.find((b) => b.tipo === 'tabela')?.colunas.length ?? -1,
    );
    expect(larguras.reduce((a, b) => a + b, 0)).toBe(larguraUtilDxa());
    expect(larguraUtilDxa()).toBe(9666);
    expect(documento).toContain(caso.aviso);
  });
});
