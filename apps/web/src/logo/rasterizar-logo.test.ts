import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOGO_TAMANHO_MAX_BYTES, LOGO_TEMPO_MAX_MS } from '../config/logo';
import type { Dimensoes } from '../document/medidas';
import { bytesGif, bytesPng, bytesTexto } from '../test/bytes-logo';
import { AMBIENTE_NAVEGADOR, prepararLogo, type AmbienteRaster } from './rasterizar-logo';
import { ErroDeLogo, MENSAGEM_ERRO_LOGO } from './validar-logo';

const PREFIXO_PNG = 'data:image/png;base64,';
const SVG_MALICIOSO =
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" onload="alert(1)">' +
  '<script>document.title="x"</script>' +
  '<image href="https://exemplo.invalid/rastreio.png"/>' +
  '<rect width="200" height="100"/></svg>';

// Capturado antes de instalar timers falsos.
const setTimeoutReal = globalThis.setTimeout;

const urlCriada = vi.fn<(blob: Blob) => string>();
const urlRevogada = vi.fn<(url: string) => void>();

/** O jsdom não implementa createObjectURL/revokeObjectURL: troca a URL global por uma que implementa. */
class URLComBlob extends URL {
  static override createObjectURL = urlCriada;
  static override revokeObjectURL = urlRevogada;
}

beforeEach(() => {
  urlCriada.mockReset().mockReturnValue('blob:http://localhost/logo-1');
  urlRevogada.mockReset();
  vi.stubGlobal('URL', URLComBlob);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function arquivo(bytes: Uint8Array, tipo = ''): Blob {
  return new Blob([bytes as BlobPart], { type: tipo });
}

/** Ambiente falso: `natural` é o que o navegador informaria; `paraPng` registra o que recebeu. */
function ambienteFalso(natural: Dimensoes) {
  const decodificar = vi.fn<AmbienteRaster['decodificar']>(() =>
    Promise.resolve({ dimensoes: natural, fonte: {} as CanvasImageSource }),
  );
  const paraPng = vi.fn<AmbienteRaster['paraPng']>(() => PREFIXO_PNG + 'AAAA');
  return { ambiente: { decodificar, paraPng } satisfies AmbienteRaster, decodificar, paraPng };
}

async function motivoDe(promessa: Promise<unknown>): Promise<string> {
  try {
    await promessa;
  } catch (e) {
    expect(e).toBeInstanceOf(ErroDeLogo);
    return (e as ErroDeLogo).motivo;
  }
  throw new Error('deveria ter recusado');
}

const svgComViewBox = (viewBox: string): Blob =>
  arquivo(bytesTexto(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"></svg>`));

describe('prepararLogo — recusa antes de decodificar', () => {
  it('arquivo acima do tamanho máximo: grande, sem decodificar', async () => {
    const { ambiente, decodificar } = ambienteFalso({ largura: 10, altura: 10 });
    const enorme = arquivo(new Uint8Array(LOGO_TAMANHO_MAX_BYTES + 1), 'image/png');
    expect(await motivoDe(prepararLogo(enorme, ambiente))).toBe('grande');
    expect(decodificar).not.toHaveBeenCalled();
    expect(urlCriada).not.toHaveBeenCalled();
  });

  it('PNG de bomba (2 KB declarando 20000×20000): dimensoes, sem decodificar', async () => {
    const { ambiente, decodificar } = ambienteFalso({ largura: 20000, altura: 20000 });
    expect(
      await motivoDe(prepararLogo(arquivo(bytesPng(20000, 20000), 'image/png'), ambiente)),
    ).toBe('dimensoes');
    expect(decodificar).not.toHaveBeenCalled();
  });

  it('PNG de 6000×5000 (lados ok, 30 Mpx): area, sem decodificar', async () => {
    const { ambiente, decodificar } = ambienteFalso({ largura: 6000, altura: 5000 });
    expect(await motivoDe(prepararLogo(arquivo(bytesPng(6000, 5000)), ambiente))).toBe('area');
    expect(decodificar).not.toHaveBeenCalled();
  });

  it('GIF com nome e tipo de PNG: formato, sem decodificar', async () => {
    const { ambiente, decodificar } = ambienteFalso({ largura: 1, altura: 1 });
    const falso = new File([bytesGif() as BlobPart], 'logo.png', { type: 'image/png' });
    expect(await motivoDe(prepararLogo(falso, ambiente))).toBe('formato');
    expect(decodificar).not.toHaveBeenCalled();
  });

  it('arquivo vazio: vazio', async () => {
    const { ambiente } = ambienteFalso({ largura: 1, altura: 1 });
    expect(await motivoDe(prepararLogo(arquivo(new Uint8Array()), ambiente))).toBe('vazio');
  });

  it('SVG com proporção extrema, medida infinita ou zero: recusado sem decodificar', async () => {
    const { ambiente, decodificar } = ambienteFalso({ largura: 300, altura: 150 });
    expect(await motivoDe(prepararLogo(svgComViewBox('0 0 3000 100'), ambiente))).toBe('proporcao');
    expect(await motivoDe(prepararLogo(svgComViewBox('0 0 1e999 10'), ambiente))).toBe('ilegivel');
    expect(await motivoDe(prepararLogo(svgComViewBox('0 0 0 0'), ambiente))).toBe('ilegivel');
    expect(
      await motivoDe(
        prepararLogo(arquivo(bytesTexto('<svg width="0" height="50"></svg>')), ambiente),
      ),
    ).toBe('ilegivel');
    expect(decodificar).not.toHaveBeenCalled();
  });
});

describe('prepararLogo — bitmap, ambiente falso', () => {
  it('3000×1000 vira 1200×400; 100×50 não é ampliado', async () => {
    const grande = ambienteFalso({ largura: 3000, altura: 1000 });
    const logo = await prepararLogo(arquivo(bytesPng(3000, 1000), 'image/png'), grande.ambiente);
    expect(grande.paraPng.mock.calls[0]?.[1]).toEqual({ largura: 1200, altura: 400 });
    expect(logo).toMatchObject({ largura: 1200, altura: 400 });

    const pequeno = ambienteFalso({ largura: 100, altura: 50 });
    const menor = await prepararLogo(arquivo(bytesPng(100, 50), 'image/png'), pequeno.ambiente);
    expect(pequeno.paraPng.mock.calls[0]?.[1]).toEqual({ largura: 100, altura: 50 });
    expect(menor).toMatchObject({ largura: 100, altura: 50 });
  });

  it('a URL é revogada ao terminar, com sucesso ou falha', async () => {
    const ok = ambienteFalso({ largura: 100, altura: 50 });
    await prepararLogo(arquivo(bytesPng(100, 50)), ok.ambiente);
    expect(urlRevogada).toHaveBeenCalledWith('blob:http://localhost/logo-1');

    urlRevogada.mockClear();
    const { ambiente } = ambienteFalso({ largura: 100, altura: 50 });
    ambiente.decodificar.mockRejectedValueOnce(new Error('detalhe interno da biblioteca'));
    const motivo = await motivoDe(prepararLogo(arquivo(bytesPng(100, 50)), ambiente));
    expect(motivo).toBe('ilegivel');
    expect(urlRevogada).toHaveBeenCalledTimes(1);
  });

  it('a mensagem de erro é a do app, nunca o texto da biblioteca', async () => {
    const { ambiente } = ambienteFalso({ largura: 100, altura: 50 });
    ambiente.decodificar.mockRejectedValueOnce(new Error('dados da ata: João Silva'));
    await expect(prepararLogo(arquivo(bytesPng(100, 50)), ambiente)).rejects.toThrow(
      MENSAGEM_ERRO_LOGO.ilegivel,
    );
  });

  it('decodificação que não termina: ilegivel após LOGO_TEMPO_MAX_MS, aborta e revoga a URL', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { ambiente, decodificar } = ambienteFalso({ largura: 100, altura: 50 });
    decodificar.mockImplementation(() => new Promise(() => undefined));
    const resultado = expect(prepararLogo(arquivo(bytesPng(100, 50)), ambiente)).rejects.toThrow(
      MENSAGEM_ERRO_LOGO.ilegivel,
    );
    // Só os timers de setTimeout são falsos: deixa a leitura do blob terminar de verdade.
    for (let i = 0; i < 100 && decodificar.mock.calls.length === 0; i++) {
      await new Promise((r) => setTimeoutReal(r, 0));
    }
    expect(decodificar).toHaveBeenCalledTimes(1);
    const sinal = decodificar.mock.calls[0]?.[1];
    await vi.advanceTimersByTimeAsync(LOGO_TEMPO_MAX_MS - 1);
    expect(urlRevogada).not.toHaveBeenCalled();
    expect(sinal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await resultado;
    expect(sinal?.aborted).toBe(true);
    expect(urlRevogada).toHaveBeenCalledTimes(1);
  });

  it('dimensão natural 0 em bitmap: ilegivel', async () => {
    const { ambiente, paraPng } = ambienteFalso({ largura: 0, altura: 0 });
    expect(await motivoDe(prepararLogo(arquivo(bytesPng(100, 50)), ambiente))).toBe('ilegivel');
    expect(paraPng).not.toHaveBeenCalled();
  });

  it('PNG gerado que não é um data URL de PNG (canvas grande demais): ilegivel', async () => {
    const { ambiente, paraPng } = ambienteFalso({ largura: 100, altura: 50 });
    paraPng.mockReturnValueOnce('data:,');
    expect(await motivoDe(prepararLogo(arquivo(bytesPng(100, 50)), ambiente))).toBe('ilegivel');
  });

  it('canvas contaminado (SecurityError, p.ex. SVG com foreignObject): ilegivel', async () => {
    const { ambiente, paraPng } = ambienteFalso({ largura: 100, altura: 50 });
    paraPng.mockImplementationOnce(() => {
      throw new DOMException('tainted', 'SecurityError');
    });
    expect(await motivoDe(prepararLogo(arquivo(bytesPng(100, 50)), ambiente))).toBe('ilegivel');
    expect(urlRevogada).toHaveBeenCalledTimes(1);
  });
});

describe('prepararLogo — SVG nunca vira markup e é dimensionado pela proporção', () => {
  it('com <script>, onload e referência externa: o ambiente recebe só uma URL blob:', async () => {
    const { ambiente, decodificar } = ambienteFalso({ largura: 200, altura: 100 });
    await prepararLogo(
      new File([bytesTexto(SVG_MALICIOSO) as BlobPart], 'logo.svg', { type: 'image/svg+xml' }),
      ambiente,
    );
    const recebida = decodificar.mock.calls[0]?.[0] ?? '';
    expect(recebida.startsWith('blob:')).toBe(true);
    expect(recebida).not.toContain('<svg');
  });

  it('o tipo do blob vem do conteúdo, não do que a pessoa declarou', async () => {
    const { ambiente } = ambienteFalso({ largura: 200, altura: 100 });
    await prepararLogo(arquivo(bytesTexto(SVG_MALICIOSO), 'text/html'), ambiente);
    expect(urlCriada.mock.calls[0]?.[0].type).toBe('image/svg+xml');

    urlCriada.mockClear();
    await prepararLogo(arquivo(bytesPng(100, 50), 'text/html'), ambiente);
    expect(urlCriada.mock.calls[0]?.[0].type).toBe('image/png');
  });

  it('o tamanho do navegador é ignorado: vale a proporção declarada (viewBox, width/height, 300×150)', async () => {
    // O Chrome informa 300×100 para um SVG só com viewBox 2400×800.
    const a = ambienteFalso({ largura: 300, altura: 100 });
    expect(await prepararLogo(svgComViewBox('0 0 2400 800'), a.ambiente)).toMatchObject({
      largura: 1200,
      altura: 400,
    });
    expect(a.paraPng.mock.calls[0]?.[1]).toEqual({ largura: 1200, altura: 400 });

    const b = ambienteFalso({ largura: 0, altura: 0 });
    await prepararLogo(arquivo(bytesTexto('<svg></svg>')), b.ambiente);
    expect(b.paraPng.mock.calls[0]?.[1]).toEqual({ largura: 800, altura: 400 });

    const c = ambienteFalso({ largura: 1, altura: 1 });
    await prepararLogo(arquivo(bytesTexto(SVG_MALICIOSO)), c.ambiente);
    expect(c.paraPng.mock.calls[0]?.[1]).toEqual({ largura: 800, altura: 400 });
  });

  it('SVG pequeno é ampliado até a caixa: 24×24 vira 400×400; 1×1 também', async () => {
    const a = ambienteFalso({ largura: 24, altura: 24 });
    expect(await prepararLogo(svgComViewBox('0 0 24 24'), a.ambiente)).toMatchObject({
      largura: 400,
      altura: 400,
    });
    expect(a.paraPng.mock.calls[0]?.[1]).toEqual({ largura: 400, altura: 400 });

    const b = ambienteFalso({ largura: 1, altura: 1 });
    await prepararLogo(
      arquivo(bytesTexto('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>')),
      b.ambiente,
    );
    expect(b.paraPng.mock.calls[0]?.[1]).toEqual({ largura: 400, altura: 400 });
  });
});

describe('AMBIENTE_NAVEGADOR.decodificar', () => {
  it('ao receber o sinal de abortar, solta a imagem (src vazio)', () => {
    const imagens: { src: string; decoding: string }[] = [];
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        decoding = '';
        naturalWidth = 0;
        naturalHeight = 0;
        constructor() {
          imagens.push(this);
        }
        decode(): Promise<void> {
          return new Promise(() => undefined);
        }
      },
    );
    const controle = new AbortController();
    void AMBIENTE_NAVEGADOR.decodificar('blob:http://localhost/x', controle.signal);
    expect(imagens[0]?.src).toBe('blob:http://localhost/x');
    controle.abort();
    expect(imagens[0]?.src).toBe('');
  });
});

describe('prepararLogo — pipeline com o paraPng real (canvas mockado)', () => {
  function instalarCanvas() {
    const drawImage = vi.fn();
    const medidasNoExport: Dimensoes[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
      medidasNoExport.push({ largura: this.width, altura: this.height });
      return PREFIXO_PNG + 'QUJD';
    });
    return { drawImage, medidasNoExport };
  }

  const comNatural = (natural: Dimensoes, fonte = {} as CanvasImageSource): AmbienteRaster => ({
    decodificar: () => Promise.resolve({ dimensoes: natural, fonte }),
    paraPng: AMBIENTE_NAVEGADOR.paraPng,
  });

  it('bitmap 3000×1000: desenha em 1200×400 e exporta com o canvas desse tamanho', async () => {
    const { drawImage, medidasNoExport } = instalarCanvas();
    const fonte = { id: 'imagem-decodificada' } as unknown as CanvasImageSource;
    const logo = await prepararLogo(
      arquivo(bytesPng(3000, 1000), 'image/png'),
      comNatural({ largura: 3000, altura: 1000 }, fonte),
    );
    expect(drawImage).toHaveBeenCalledWith(fonte, 0, 0, 1200, 400);
    expect(medidasNoExport).toEqual([{ largura: 1200, altura: 400 }]);
    expect(logo).toEqual({ dataUrl: PREFIXO_PNG + 'QUJD', largura: 1200, altura: 400 });
  });

  it('bitmap pequeno não é ampliado no canvas', async () => {
    const { drawImage, medidasNoExport } = instalarCanvas();
    await prepararLogo(arquivo(bytesPng(100, 50)), comNatural({ largura: 100, altura: 50 }));
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 100, 50);
    expect(medidasNoExport).toEqual([{ largura: 100, altura: 50 }]);
  });

  it('SVG pequeno (viewBox 24×24) é desenhado ampliado, 400×400', async () => {
    const { drawImage, medidasNoExport } = instalarCanvas();
    const logo = await prepararLogo(
      svgComViewBox('0 0 24 24'),
      comNatural({ largura: 24, altura: 24 }),
    );
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 400, 400);
    expect(medidasNoExport).toEqual([{ largura: 400, altura: 400 }]);
    expect(logo).toMatchObject({ largura: 400, altura: 400 });
  });

  it('SVG malicioso: só o desenho do canvas segue adiante, no tamanho calculado', async () => {
    const { drawImage } = instalarCanvas();
    const logo = await prepararLogo(
      arquivo(bytesTexto(SVG_MALICIOSO), 'image/svg+xml'),
      comNatural({ largura: 200, altura: 100 }),
    );
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 800, 400);
    expect(logo).toMatchObject({ largura: 800, altura: 400 });
  });

  it('sem contexto 2D no canvas: falha em paraPng vira ilegivel', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(
      await motivoDe(
        prepararLogo(arquivo(bytesPng(100, 50)), comNatural({ largura: 100, altura: 50 })),
      ),
    ).toBe('ilegivel');
  });
});
