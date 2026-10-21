// @vitest-environment node
import { extractText } from 'unpdf';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AVISO_MINUTA, RODAPE_INTERNO_IA } from '../../config/documento';
import type { DocBloco, DocumentModel } from '../../document/model';
import { modeloDeVolume } from '../../test/documento-volume';
import { TEMPO_VOLUME_MS } from '../../test/tempos';
import { caracteresSemFonte } from './cobertura';
import { gerarPdf } from './gerar-pdf';

/** Teto de tempo da geração de 200 participantes × 200 encaminhamentos (spec: volume). */
const TEMPO_MAXIMO_VOLUME_MS = 15_000;

const espacos = (texto: string) => texto.replace(/\s+/g, ' ');

async function bytesDoPdf(modelo: DocumentModel): Promise<Uint8Array> {
  return new Uint8Array(await (await gerarPdf(modelo)).arrayBuffer());
}

async function paginas(bytes: Uint8Array): Promise<string[]> {
  // pdf.js pode transferir o buffer: extrai de uma cópia para manter os bytes do teste.
  const { text } = await extractText(bytes.slice(), { mergePages: false });
  return text.map(espacos);
}

const latin1 = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);

const cp = (...pontos: number[]) => String.fromCodePoint(...pontos);

/** Único aviso aceito: o pdfmake no Node pede política de acesso local (no navegador não há). */
const AVISO_ACESSO_LOCAL = 'No local access policy defined.';

/** Texto de IA/chat com o que as fontes não desenham ou o PDF descarta/troca. */
const TEXTO_PROBLEMATICO = `Código D${cp(0x2011)}1 de ${cp(0x2068)}Nome Isolado${cp(0x2069)}, co${cp(0x00ad)}operação, Ж e ${cp(0x1f600)}.`;

function comParagrafo(modelo: DocumentModel, texto: string): DocumentModel {
  return { ...modelo, blocos: [...modelo.blocos, { tipo: 'paragrafo', partes: [{ texto }] }] };
}

const tres = (i: number) => String(i).padStart(3, '0');
const RECHEIO =
  'revisar o orçamento anual com as áreas envolvidas e registrar as pendências '.repeat(3);

/** Troca a ação de cada encaminhamento por um texto longo (várias linhas) com marcas nas pontas. */
function comAcoesLongas(modelo: DocumentModel): DocumentModel {
  const trocar = (b: DocBloco): DocBloco => {
    if (b.tipo === 'secao') return { ...b, blocos: b.blocos.map(trocar) };
    if (b.tipo !== 'tabela' || b.colunas[0] !== 'Ação') return b;
    return {
      ...b,
      linhas: b.linhas.map((l, i) => [
        `Início da tarefa ${tres(i + 1)} ${RECHEIO}fim da tarefa ${tres(i + 1)}`,
        ...l.slice(1),
      ]),
    };
  };
  return { ...modelo, blocos: modelo.blocos.map(trocar) };
}

const LINHAS_LONGAS = 80;

/** Chamadas a `fetch` durante as gerações (medidas antes de o pdf.js do teste ler os PDFs). */
let chamadasFetch: number;
let simples: DocumentModel;
let bytesSimples: Uint8Array;
let bytesComLogo: Uint8Array;
let bytesVolume: Uint8Array;
let tempoVolumeMs: number;
let problematico: DocumentModel;
let bytesProblematico: Uint8Array;
let tempoProblematicoMs: number;
let bytesLongas: Uint8Array;
const avisosInesperados: unknown[][] = [];

beforeAll(async () => {
  // No Node, o pdfmake avisa que não há política de acesso a arquivos locais (no navegador o
  // aviso não existe: ver `isServer` em pdfmake/src/base.js). Só ESSE aviso é aceito; qualquer
  // outro fica registrado e reprova o teste "nenhum aviso inesperado".
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith(AVISO_ACESSO_LOCAL)) return;
    avisosInesperados.push(args);
  });
  const fetchEspiao = vi.spyOn(globalThis, 'fetch');

  simples = modeloDeVolume({ participantes: 3, encaminhamentos: 3 });
  bytesSimples = await bytesDoPdf(simples);
  bytesComLogo = await bytesDoPdf(
    modeloDeVolume({ participantes: 3, encaminhamentos: 3, logo: true }),
  );
  const inicio = performance.now();
  bytesVolume = await bytesDoPdf(modeloDeVolume({ participantes: 200, encaminhamentos: 200 }));
  tempoVolumeMs = performance.now() - inicio;
  problematico = comParagrafo(
    modeloDeVolume({ participantes: 1, encaminhamentos: 1 }),
    TEXTO_PROBLEMATICO,
  );
  const inicioProblematico = performance.now();
  bytesProblematico = await bytesDoPdf(problematico);
  tempoProblematicoMs = performance.now() - inicioProblematico;
  bytesLongas = await bytesDoPdf(
    comAcoesLongas(modeloDeVolume({ participantes: 1, encaminhamentos: LINHAS_LONGAS })),
  );
  chamadasFetch = fetchEspiao.mock.calls.length;
  fetchEspiao.mockRestore();
}, TEMPO_VOLUME_MS * 2);

afterAll(() => {
  vi.restoreAllMocks();
});

describe('gerarPdf', () => {
  it('gera um PDF', () => {
    expect(latin1(bytesSimples.subarray(0, 5))).toBe('%PDF-');
  });

  it('acentos pt-BR, nome NFD (sai composto), latin-ext, título e aviso de minuta legíveis', async () => {
    const texto = (await paginas(bytesSimples)).join(' ');
    expect(texto).toContain('Ação');
    expect(texto).toContain('João Decomposto');
    expect(texto).toContain('Łukasz Żółć');
    expect(texto).toContain(simples.titulo);
    expect(texto).toContain(espacos(AVISO_MINUTA.slice(0, 80)));
  });

  it('o modelo tem rodapé interno, e o PDF não o imprime', async () => {
    expect(simples.rodapeInterno).not.toBeNull();
    const texto = (await paginas(bytesSimples)).join(' ');
    expect(texto).not.toContain(RODAPE_INTERNO_IA);
  });

  it('nenhum aviso inesperado no console durante as gerações', () => {
    expect(avisosInesperados).toEqual([]);
  });

  it('com logo, o PDF embute uma imagem; sem logo, nenhuma', () => {
    expect(latin1(bytesComLogo)).toContain('/Subtype /Image');
    expect(latin1(bytesSimples)).not.toContain('/Subtype /Image');
  });
});

describe('gerarPdf com 200 participantes e 200 encaminhamentos', () => {
  it(`gera em menos de ${String(TEMPO_MAXIMO_VOLUME_MS / 1000)} s`, () => {
    expect(tempoVolumeMs).toBeLessThan(TEMPO_MAXIMO_VOLUME_MS);
  });

  it('várias páginas, todas com "Página X de Y"', async () => {
    const texto = await paginas(bytesVolume);
    expect(texto.length).toBeGreaterThanOrEqual(5);
    texto.forEach((pagina, i) => {
      expect(pagina).toContain(`Página ${String(i + 1)} de ${String(texto.length)}`);
    });
  });

  it('o cabeçalho de cada tabela se repete em toda página em que ela continua', async () => {
    const texto = await paginas(bytesVolume);
    const comTarefas = texto.filter((p) => p.includes('Tarefa de volume nº'));
    const comParticipantes = texto.filter((p) => p.includes('Participante de volume'));
    expect(comTarefas.length).toBeGreaterThanOrEqual(2);
    expect(comParticipantes.length).toBeGreaterThanOrEqual(2);
    for (const pagina of comTarefas) {
      expect(pagina).toContain('Responsável');
      // "Prazo" e "Status" só existem no cabeçalho (as células trazem datas e rótulos).
      expect(pagina).toContain('Prazo');
      expect(pagina).toContain('Status');
    }
    for (const pagina of comParticipantes) {
      expect(pagina).toContain('Presença');
      expect(pagina).toContain('Cargo / empresa');
    }
  });

  it('nenhuma requisição de rede em nenhuma das gerações (simples, logo e volume)', () => {
    expect(chamadasFetch).toBe(0);
  });
});

describe('gerarPdf com texto de IA/chat que as fontes não desenham', () => {
  it('gera sem lançar e dentro do teto de tempo', () => {
    expect(latin1(bytesProblematico.subarray(0, 5))).toBe('%PDF-');
    expect(tempoProblematicoMs).toBeLessThan(TEMPO_MAXIMO_VOLUME_MS);
  });

  it('hífen inquebrável sai como "-"; isolamento bidi e hífen suave não chegam ao PDF', async () => {
    const texto = (await paginas(bytesProblematico)).join(' ');
    expect(texto).toContain('D-1');
    expect(texto).toContain('Nome Isolado');
    expect(texto).toContain('cooperação');
    for (const ponto of [0x2011, 0x2068, 0x2069, 0x00ad]) expect(texto).not.toContain(cp(ponto));
  });

  it('o aviso prévio lista exatamente o que sairia sem desenho: Ж e o emoji', () => {
    expect(caracteresSemFonte(problematico)).toEqual(['Ж', cp(0x1f600)]);
  });
});

describe('gerarPdf: linha de tabela longa nunca se parte entre páginas', () => {
  it('início e fim de cada ação longa estão na mesma página', async () => {
    const texto = await paginas(bytesLongas);
    expect(texto.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i <= LINHAS_LONGAS; i += 1) {
      const comInicio = texto.findIndex((p) => p.includes(`Início da tarefa ${tres(i)}`));
      const comFim = texto.findIndex((p) => p.includes(`fim da tarefa ${tres(i)}`));
      expect(comInicio, `tarefa ${tres(i)}`).toBeGreaterThanOrEqual(0);
      expect(comFim, `tarefa ${tres(i)}`).toBe(comInicio);
    }
  });
});

describe('gerarPdf: título de seção nunca fica sozinho no pé da página', () => {
  const TITULO = 'TITULOALVO';
  const modeloComEnchimento = (paragrafos: number): DocumentModel => ({
    titulo: 'Ata de teste',
    cabecalho: { logo: null, linhas: ['Organização de teste'] },
    rodape: 'Página {pagina} de {total}',
    rodapeInterno: null,
    blocos: [
      ...Array.from({ length: paragrafos }, (_, i): DocBloco => ({
        tipo: 'paragrafo',
        partes: [{ texto: `Parágrafo de enchimento ${String(i)}.` }],
      })),
      {
        tipo: 'secao',
        chave: 'alvo',
        titulo: TITULO,
        gerada: false,
        blocos: [{ tipo: 'paragrafo', partes: [{ texto: 'Corpo curto da seção.' }] }],
      },
    ],
  });
  // Quantos parágrafos cabem numa página depende da tipografia: a varredura cobre a virada de
  // página inteira (de pouco enchimento até mais de uma página), então algum caso deixa só o
  // espaço do título no pé.
  const ENCHIMENTOS = Array.from({ length: 24 }, (_, i) => i + 17);

  it('a varredura de enchimento chega a empurrar o título para a 2ª página', async () => {
    const ultimo = await paginas(await bytesDoPdf(modeloComEnchimento(ENCHIMENTOS.at(-1) ?? 0)));
    expect(ultimo.length).toBeGreaterThanOrEqual(2);
  });

  it('nenhuma página termina no título (o corpo da seção vai junto)', async () => {
    const orfas: string[] = [];
    for (const n of ENCHIMENTOS) {
      const texto = await paginas(await bytesDoPdf(modeloComEnchimento(n)));
      texto.forEach((pagina, i) => {
        const semRodape = pagina.replace(/Página \d+ de \d+\s*$/, '').trim();
        if (semRodape.endsWith(TITULO))
          orfas.push(`enchimento ${String(n)}, página ${String(i + 1)}`);
      });
    }
    expect(orfas).toEqual([]);
  });
});
