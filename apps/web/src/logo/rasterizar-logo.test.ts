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

beforeEach(() => {
  urlCriada.mockReset().mockReturnValue('blob:http://localhost/logo-1');
  urlRevogada.mockReset();
  URL.createObjectURL = urlCriada;
  URL.revokeObjectURL = urlRevogada;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  // @ts-expect-error o jsdom não implementa createObjectURL; remove o stub do teste
  delete URL.createObjectURL;
  // @ts-expect-error o jsdom não implementa revokeObjectURL; remove o stub do teste
  delete URL.revokeObjectURL;
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
});

describe('prepararLogo — ambiente falso', () => {
  it('3000×1000 vira 1200×400; 100×50 não é ampliado', async () => {
    const grande = ambienteFalso({ largura: 3000, altura: 1000 });
    const logo = await prepararLogo(arquivo(bytesPng(3000, 1000), 'image/png'), grande.ambiente);
    expect(grande.paraPng.mock.calls[0]?.[1]).toEqual({ largura: 1200, altura: 400 });
    expect(logo).toEqual({ dataUrl: PREFIXO_PNG + 'AAAA', largura: 1200, altura: 400 });

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

  it('decodificação que não termina: ilegivel após LOGO_TEMPO_MAX_MS, e revoga a URL', async () => {
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
    await vi.advanceTimersByTimeAsync(LOGO_TEMPO_MAX_MS - 1);
    expect(urlRevogada).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await resultado;
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

describe('prepararLogo — SVG nunca vira markup', () => {
  it('com <script>, onload e referência externa: o ambiente recebe só uma URL blob:', async () => {
    const { ambiente, decodificar, paraPng } = ambienteFalso({ largura: 200, altura: 100 });
    const logo = await prepararLogo(
      new File([bytesTexto(SVG_MALICIOSO) as BlobPart], 'logo.svg', { type: 'image/svg+xml' }),
      ambiente,
    );
    const recebida = decodificar.mock.calls[0]?.[0] ?? '';
    expect(recebida.startsWith('blob:')).toBe(true);
    expect(recebida).not.toContain('<svg');
    expect(paraPng).toHaveBeenCalledTimes(1);
    expect(logo.dataUrl.startsWith(PREFIXO_PNG)).toBe(true);
    expect(logo.dataUrl).not.toContain('<svg');
    expect(logo.dataUrl).not.toContain('script');
  });

  it('o tipo do blob vem do conteúdo, não do que a pessoa declarou', async () => {
    const { ambiente } = ambienteFalso({ largura: 200, altura: 100 });
    await prepararLogo(arquivo(bytesTexto(SVG_MALICIOSO), 'text/html'), ambiente);
    expect(urlCriada.mock.calls[0]?.[0].type).toBe('image/svg+xml');

    urlCriada.mockClear();
    await prepararLogo(arquivo(bytesPng(100, 50), 'text/html'), ambiente);
    expect(urlCriada.mock.calls[0]?.[0].type).toBe('image/png');
  });

  it('SVG sem width/height usa o viewBox; sem viewBox, o tamanho do navegador ou 300×150', async () => {
    // O Chrome informa 300×100 para um SVG só com viewBox 2400×800: vale o declarado.
    const comViewBox = ambienteFalso({ largura: 300, altura: 100 });
    const a = await prepararLogo(
      arquivo(bytesTexto('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 800"></svg>')),
      comViewBox.ambiente,
    );
    expect(comViewBox.paraPng.mock.calls[0]?.[1]).toEqual({ largura: 1200, altura: 400 });
    expect(a).toMatchObject({ largura: 1200, altura: 400 });

    const nada = ambienteFalso({ largura: 0, altura: 0 });
    const b = await prepararLogo(arquivo(bytesTexto('<svg></svg>')), nada.ambiente);
    expect(b).toMatchObject({ largura: 300, altura: 150 });

    const doNavegador = ambienteFalso({ largura: 320, altura: 200 });
    const c = await prepararLogo(arquivo(bytesTexto('<svg></svg>')), doNavegador.ambiente);
    expect(c).toMatchObject({ largura: 320, altura: 200 });
  });
});

describe('prepararLogo — pipeline com o canvas real da rasterização (mock de canvas)', () => {
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

  it('desenha na dimensão encaixada, exporta PNG com o canvas desse tamanho e devolve o LogoDoc', async () => {
    const { drawImage, medidasNoExport } = instalarCanvas();
    const fonte = { id: 'imagem-decodificada' } as unknown as CanvasImageSource;
    const ambiente: AmbienteRaster = {
      decodificar: () => Promise.resolve({ dimensoes: { largura: 3000, altura: 1000 }, fonte }),
      paraPng: AMBIENTE_NAVEGADOR.paraPng,
    };
    const logo = await prepararLogo(arquivo(bytesPng(3000, 1000), 'image/png'), ambiente);
    expect(drawImage).toHaveBeenCalledWith(fonte, 0, 0, 1200, 400);
    expect(medidasNoExport).toEqual([{ largura: 1200, altura: 400 }]);
    expect(logo).toEqual({ dataUrl: PREFIXO_PNG + 'QUJD', largura: 1200, altura: 400 });
  });

  it('não amplia imagem pequena no canvas', async () => {
    const { drawImage, medidasNoExport } = instalarCanvas();
    const ambiente: AmbienteRaster = {
      decodificar: () =>
        Promise.resolve({
          dimensoes: { largura: 100, altura: 50 },
          fonte: {} as CanvasImageSource,
        }),
      paraPng: AMBIENTE_NAVEGADOR.paraPng,
    };
    await prepararLogo(arquivo(bytesPng(100, 50)), ambiente);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 100, 50);
    expect(medidasNoExport).toEqual([{ largura: 100, altura: 50 }]);
  });

  it('SVG malicioso: a saída é só o PNG do canvas', async () => {
    instalarCanvas();
    const ambiente: AmbienteRaster = {
      decodificar: () =>
        Promise.resolve({
          dimensoes: { largura: 200, altura: 100 },
          fonte: {} as CanvasImageSource,
        }),
      paraPng: AMBIENTE_NAVEGADOR.paraPng,
    };
    const logo = await prepararLogo(arquivo(bytesTexto(SVG_MALICIOSO), 'image/svg+xml'), ambiente);
    expect(logo.dataUrl).toBe(PREFIXO_PNG + 'QUJD');
  });

  it('sem contexto 2D no canvas: falha em paraPng vira ilegivel', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const ambiente: AmbienteRaster = {
      decodificar: () =>
        Promise.resolve({
          dimensoes: { largura: 100, altura: 50 },
          fonte: {} as CanvasImageSource,
        }),
      paraPng: AMBIENTE_NAVEGADOR.paraPng,
    };
    expect(await motivoDe(prepararLogo(arquivo(bytesPng(100, 50)), ambiente))).toBe('ilegivel');
  });
});
