// @vitest-environment node
import { extractText } from 'unpdf';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cipa } from '../ata-types/cipa';
import { presentes } from '../ata-types/comum-formal';
import { condominio } from '../ata-types/condominio';
import { sociosLtda } from '../ata-types/socios-ltda';
import type { AtaTypeDefinition } from '../ata-types/types';
import type { DocumentModel } from '../document/model';
import { modeloDeVolume, rascunhoDeVolume, type OpcoesVolume } from '../test/documento-volume';
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
  /** Trechos que o PDF NÃO pode trazer (ex.: o resumo, que é só do formulário). */
  foraDoPdf?: string[];
  /** Linhas de participantes do gerador de volume (padrão 12). */
  participantes?: number;
  /** Aviso final do tipo, conferido no `document.xml`. */
  aviso: string;
}

const DADOS_CONDOMINIO: Record<string, string> = {
  condominio: 'Condomínio Edifício Exemplo',
  cnpj: '11.222.333/0001-81',
  endereco: 'Rua das Flores, 100, Centro, Cidade Exemplo/SP',
  natureza: 'ordinaria',
  chamada: 'primeira',
  edital_data: '2026-10-01',
  data: '2026-10-14',
  inicio: '19:30',
  fim: '21:45',
  modalidade: 'presencial',
  local: 'Salão de festas',
  presidente: 'Carla Mendes',
  secretario: 'Diego Faria',
  assinaturas_presentes: 'mesa',
};

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
    extras: (i) => ({ representacao: i % 2 ? 'empregados' : 'organizacao', condicao: 'titular' }),
    noPdf: ['Comissão Interna de Prevenção de Acidentes e de Assédio', 'Representação', '5.6.3.2'],
    aviso: cipa.textosFixos?.avisoDisponibilizacao ?? 'aviso ausente',
  },
  {
    tipo: condominio,
    dados: DADOS_CONDOMINIO,
    // A fração (opcional) só de alguns: sem nenhuma, a coluna sairia do documento.
    extras: (i) => ({
      unidade: `Apto ${String(100 + i)}`,
      vinculo: 'proprietario',
      ...(i % 4 === 0 ? { fracao: '1/48' } : {}),
    }),
    noPdf: ['Assembleia Geral Ordinária', 'Unidade', 'Vínculo', 'Fração ideal', 'Mesa'],
    aviso: condominio.textosFixos?.avisoConvencao ?? 'aviso ausente',
  },
  {
    tipo: sociosLtda,
    participantes: 8,
    dados: {
      razao_social: 'Empresa Exemplo Ltda.',
      cnpj: '11.222.333/0001-81',
      nire: '35212345678',
      sede: 'Rua das Flores, 100, Centro, Cidade Exemplo/SP',
      forma: 'assembleia',
      data: '2026-10-14',
      inicio: '10:00',
      fim: '11:30',
      modalidade: 'presencial',
      local: 'Sala de reuniões da sede',
      convocacao: 'ciencia_escrita',
      presidente: 'Carla Mendes',
      secretario: 'Diego Faria',
      modo_capital: 'percentual',
      declaracao_formalidades: 'sim',
    },
    extras: (i) => ({
      participacao: '10',
      ...(i % 3 === 0 ? { procurador: `Procuradora de volume nº ${String(i)}` } : {}),
    }),
    noPdf: [
      'do capital social, conforme as participações informadas',
      'nos 20 dias seguintes',
      'Sócios presentes',
      'Participação (%)',
    ],
    foraDoPdf: ['Capital presente informado'],
    aviso: sociosLtda.textosFixos?.avisoArquivamento ?? 'aviso ausente',
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
      participantes: caso.participantes ?? 12,
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
    for (const trecho of caso.foraDoPdf ?? []) expect(textoPdf, trecho).not.toContain(trecho);
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

describe('exportação · condominio com 200 condôminos assinando', () => {
  const o: OpcoesVolume = {
    participantes: 200,
    encaminhamentos: 20,
    tipo: condominio,
    dados: { ...DADOS_CONDOMINIO, assinaturas_presentes: 'todos' },
    extras: (i) => ({ unidade: `Apto ${String(100 + i)}`, vinculo: 'proprietario' }),
  };
  // O gerador marca parte dos participantes como justificada: o número vem dele, nunca literal.
  const esperados = presentes(rascunhoDeVolume(o)).length;
  let paginas: string[];
  let documento: string;
  let tempoPdfMs: number;
  const avisosInesperados: unknown[][] = [];

  beforeAll(async () => {
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].startsWith(AVISO_ACESSO_LOCAL)) return;
      avisosInesperados.push(args);
    });
    const modelo = modeloDeVolume(o);
    const inicio = performance.now();
    const pdf = new Uint8Array(await (await gerarPdf(modelo)).arrayBuffer());
    tempoPdfMs = performance.now() - inicio;
    const { text } = await extractText(pdf.slice(), { mergePages: false });
    paginas = text.map(espacos);
    documento = (await xmlDoDocx(await gerarDocx(modelo))).get('word/document.xml') ?? '';
  }, TEMPO_VOLUME_MS * 2);

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('PDF em 5+ páginas, todas com "Página i de N", gerado dentro do teto', () => {
    expect(paginas.length).toBeGreaterThanOrEqual(5);
    paginas.forEach((pagina, i) => {
      expect(pagina).toContain(`Página ${String(i + 1)} de ${String(paginas.length)}`);
    });
    expect(tempoPdfMs).toBeLessThan(TEMPO_VOLUME_MS);
    expect(avisosInesperados).toEqual([]);
  });

  it('o cabeçalho da tabela (com "Unidade") se repete em toda página da lista de condôminos', () => {
    const inicioAssinaturas = paginas.findIndex((p) => p.includes('Condôminos presentes'));
    expect(inicioAssinaturas).toBeGreaterThan(1);
    const daLista = paginas
      .slice(0, inicioAssinaturas)
      .filter((p) => p.includes('Participante de volume nº'));
    // Piso: a lista ocupa mais de uma página, senão a repetição não foi provada.
    expect(daLista.length).toBeGreaterThanOrEqual(2);
    for (const pagina of daLista) expect(pagina).toContain('Unidade');
  });

  it('PDF traz o título de cada seção do tipo', () => {
    const texto = paginas.join(' ');
    for (const secao of condominio.secoes) expect(texto).toContain(secao.titulo);
  });

  it('DOCX: cabeçalho de tabela repetido e uma assinatura por condômino presente', () => {
    expect(esperados).toBeGreaterThan(150);
    expect(documento).toContain('<w:tblHeader/>');
    expect(documento.split('unidade Apto').length - 1).toBe(esperados);
  });
});
