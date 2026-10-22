// Converte o vídeo da gravação de demonstração (Playwright, `playwright.gif.config.ts`) no GIF do
// README, em duas passadas do ffmpeg (paleta própria + aplicação da paleta). Rodar à mão:
//   pnpm build && pnpm --filter @lavra/web gif
// Exige o ffmpeg no PATH ou em `FFMPEG` (caminho do executável). Nada daqui entra no app.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Teto do `docs/demo.gif`: o README é aberto em qualquer conexão. */
export const ORCAMENTO_GIF_BYTES = 3_000_000;

/**
 * Quadros por segundo, largura em px (altura proporcional) e cores da paleta. 24 cores, não 128: o
 * vídeo do Playwright (VP8) tem ruído de compressão que muda a cada quadro, e com 128 cores esse
 * ruído vira pixels diferentes em quase todo quadro. Medido em 22/10/2026 com o roteiro de ~12 s:
 * 128 cores → 5,06 MB; 32 → 3,09 MB; 24 → 2,56 MB. A interface usa poucas cores (papel, texto,
 * destaque) e com 24 o texto e o destaque do CPF seguem legíveis (conferido nos quadros).
 */
export const OPCOES_GIF = Object.freeze({ fps: 10, largura: 960, cores: 24 });

/**
 * @param {number} bytes
 * @returns {string} megabytes com duas casas (ex.: "2.56")
 */
function megabytes(bytes) {
  return (bytes / 1_000_000).toFixed(2);
}

/**
 * O que dizer quando o GIF passa do orçamento: o tamanho e as saídas (as mesmas do CONTRIBUTING).
 * @param {number} bytes tamanho do GIF gerado
 * @returns {string}
 */
export function mensagemForaDoOrcamento(bytes) {
  return `O GIF tem ${megabytes(bytes)} MB e o orçamento é ${String(ORCAMENTO_GIF_BYTES / 1_000_000)} MB: reduza fps, largura, cores ou duração.`;
}

/** Pasta onde o Playwright grava os vídeos da demonstração (`outputDir` da config do GIF). */
export const PASTA_VIDEOS = fileURLToPath(new URL('../test-results/gif/', import.meta.url));

/** Destino do GIF, na raiz do repositório. */
export const DESTINO_GIF = fileURLToPath(new URL('../../../docs/demo.gif', import.meta.url));

/**
 * Duas passadas do ffmpeg: [argsPaleta, argsGif]. Arrays para `execFileSync` (nunca shell): o
 * grafo de filtro vai inteiro em um único argumento.
 * @param {string} entrada vídeo de origem
 * @param {string} paleta PNG intermediário da paleta
 * @param {string} saida GIF final
 * @param {{ fps: number, largura: number, cores: number }} [opcoes]
 * @returns {[string[], string[]]}
 */
export function argumentosFfmpeg(entrada, paleta, saida, opcoes = OPCOES_GIF) {
  const { fps, largura, cores } = opcoes;
  const base = `fps=${String(fps)},scale=${String(largura)}:-1:flags=lanczos`;
  return [
    [
      '-y',
      '-v',
      'error',
      '-i',
      entrada,
      '-vf',
      `${base},palettegen=max_colors=${String(cores)}:stats_mode=diff`,
      paleta,
    ],
    [
      '-y',
      '-v',
      'error',
      '-i',
      entrada,
      '-i',
      paleta,
      '-lavfi',
      `${base} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
      saida,
    ],
  ];
}

/**
 * O `.webm` mais novo em `pasta` (procura nas subpastas de cada teste).
 * @param {string} pasta
 */
function videoMaisNovo(pasta) {
  /** @type {{ caminho: string, quando: number }[]} */
  const videos = readdirSync(pasta, { recursive: true, encoding: 'utf-8' })
    .filter((nome) => nome.endsWith('.webm'))
    .map((nome) => {
      const caminho = join(pasta, nome);
      return { caminho, quando: statSync(caminho).mtimeMs };
    })
    .sort((a, b) => b.quando - a.quando);
  const [maisNovo] = videos;
  if (maisNovo === undefined) {
    throw new Error(
      `Nenhum vídeo .webm em ${pasta}: rode a gravação (playwright.gif.config.ts) antes.`,
    );
  }
  return maisNovo.caminho;
}

/** Grava o GIF numa pasta temporária e só o copia para `docs/` se couber no orçamento. */
function main() {
  const ffmpeg = process.env.FFMPEG ?? 'ffmpeg';
  const entrada = videoMaisNovo(PASTA_VIDEOS);
  const temporaria = mkdtempSync(join(tmpdir(), 'lavra-gif-'));
  try {
    const paleta = join(temporaria, 'paleta.png');
    const gif = join(temporaria, 'demo.gif');
    for (const args of argumentosFfmpeg(entrada, paleta, gif)) {
      execFileSync(ffmpeg, args, { stdio: 'inherit' });
    }

    const bytes = statSync(gif).size;
    if (bytes > ORCAMENTO_GIF_BYTES) {
      console.error(mensagemForaDoOrcamento(bytes));
      process.exitCode = 1;
      return;
    }
    copyFileSync(gif, DESTINO_GIF);
    console.log(`GIF gravado em ${DESTINO_GIF} (${megabytes(bytes)} MB, a partir de ${entrada}).`);
  } finally {
    rmSync(temporaria, { recursive: true, force: true });
  }
}

const executadoDireto =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executadoDireto) main();
