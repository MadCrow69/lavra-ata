// @vitest-environment node
import { extractText } from 'unpdf';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AVISO_MINUTA, RODAPE_INTERNO_IA } from '../../config/documento';
import type { DocumentModel } from '../../document/model';
import { modeloDeVolume } from '../../test/documento-volume';
import { TEMPO_VOLUME_MS } from '../../test/tempos';
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

/** Chamadas a `fetch` durante as gerações (medidas antes de o pdf.js do teste ler os PDFs). */
let chamadasFetch: number;
let simples: DocumentModel;
let bytesSimples: Uint8Array;
let bytesComLogo: Uint8Array;
let bytesVolume: Uint8Array;
let tempoVolumeMs: number;

beforeAll(async () => {
  // No Node, o pdfmake avisa que não há política de acesso a arquivos locais (no navegador o
  // aviso não existe: ver `isServer` em pdfmake/src/base.js). Silenciado só neste arquivo.
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const fetchEspiao = vi.spyOn(globalThis, 'fetch');

  simples = modeloDeVolume({ participantes: 3, encaminhamentos: 3 });
  bytesSimples = await bytesDoPdf(simples);
  bytesComLogo = await bytesDoPdf(
    modeloDeVolume({ participantes: 3, encaminhamentos: 3, logo: true }),
  );
  const inicio = performance.now();
  bytesVolume = await bytesDoPdf(modeloDeVolume({ participantes: 200, encaminhamentos: 200 }));
  tempoVolumeMs = performance.now() - inicio;
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
