import {
  LOGO_BYTES_MAX_PNG,
  LOGO_FATOR_REDUCAO_PNG,
  LOGO_LADO_MIN_PX,
  LOGO_SAIDA_MAX_PX,
  LOGO_TAMANHO_MAX_BYTES,
  LOGO_TEMPO_MAX_MS,
} from '../config/logo';
import { encaixar, type Dimensoes } from '../document/medidas';
import type { LogoDoc } from '../document/model';
import { bytesDoDataUrlPng, PREFIXO_DATA_URL_PNG } from './png-data-url';
import { ErroDeLogo, validarBytesLogo, type FormatoLogo } from './validar-logo';

/**
 * Rasteriza a logo para PNG no navegador. Nada da imagem original segue adiante: SVG, JPEG e WebP
 * saem como PNG de um canvas, então o documento nunca carrega markup nem metadados da pessoa.
 *
 * Segurança do SVG: ele é só carregado como imagem (`<img>` com URL `blob:`), nunca inserido como
 * markup. Em contexto de imagem o navegador não executa script nem carrega recurso externo (MDN,
 * "SVG as an image"); `img-src blob:` já está na CSP. Um SVG com `foreignObject` contamina o
 * canvas e `toDataURL` lança `SecurityError`, tratado como imagem ilegível.
 *
 * Tamanho de saída: bitmap nunca é ampliado; SVG (vetorial) preenche a caixa mantendo a proporção.
 * O PNG gerado nunca passa de `LOGO_BYTES_MAX_PNG`: acima disso a escala diminui até caber.
 */

export interface AmbienteRaster {
  /** `sinal` é abortado quando a decodificação passa do tempo; o ambiente deve largar a imagem. */
  decodificar: (
    url: string,
    sinal?: AbortSignal,
  ) => Promise<{ dimensoes: Dimensoes; fonte: CanvasImageSource }>;
  /** PNG em data URL (`data:image/png;base64,…`) da `fonte` desenhada em `saida`. */
  paraPng: (fonte: CanvasImageSource, saida: Dimensoes) => string;
}

export const AMBIENTE_NAVEGADOR: AmbienteRaster = {
  decodificar: async (url, sinal) => {
    const imagem = new Image();
    imagem.decoding = 'async';
    imagem.src = url;
    // Passou do tempo: solta o recurso para o navegador cancelar o carregamento.
    sinal?.addEventListener('abort', () => {
      imagem.src = '';
    });
    await imagem.decode();
    return {
      dimensoes: { largura: imagem.naturalWidth, altura: imagem.naturalHeight },
      fonte: imagem,
    };
  },
  paraPng: (fonte, saida) => {
    const canvas = document.createElement('canvas');
    canvas.width = saida.largura;
    canvas.height = saida.altura;
    const contexto = canvas.getContext('2d');
    if (contexto === null) throw new Error('canvas 2D indisponível');
    contexto.drawImage(fonte, 0, 0, saida.largura, saida.altura);
    return canvas.toDataURL('image/png');
  },
};

/** Tipo do blob decidido pelo conteúdo (nunca pelo `type` do arquivo, que a pessoa controla). */
const MIME_POR_FORMATO: Record<FormatoLogo, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

function comTempoMaximo<T>(executar: (sinal: AbortSignal) => Promise<T>): Promise<T> {
  return new Promise<T>((resolver, rejeitar) => {
    const controle = new AbortController();
    const relogio = setTimeout(() => {
      controle.abort();
      rejeitar(new ErroDeLogo('ilegivel'));
    }, LOGO_TEMPO_MAX_MS);
    executar(controle.signal).then(
      (valor) => {
        clearTimeout(relogio);
        resolver(valor);
      },
      (erro: unknown) => {
        clearTimeout(relogio);
        rejeitar(erro instanceof Error ? erro : new Error('falha'));
      },
    );
  });
}

/** Bitmap: o que o navegador decodificou; 0 = não conseguiu ler. */
function tamanhoDoBitmap(decodificado: Dimensoes): Dimensoes {
  if (!(decodificado.largura > 0 && decodificado.altura > 0)) throw new ErroDeLogo('ilegivel');
  return decodificado;
}

/**
 * Desenha em `inicial` e, se o PNG passar de `LOGO_BYTES_MAX_PNG`, repete em escala menor até
 * caber. Lança `ilegivel` se o canvas não devolver PNG ou se nem o menor tamanho aceito couber.
 */
function pngQueCabe(
  ambiente: AmbienteRaster,
  fonte: CanvasImageSource,
  inicial: Dimensoes,
): { dataUrl: string; tamanho: Dimensoes } {
  let tamanho = inicial;
  for (;;) {
    const dataUrl = ambiente.paraPng(fonte, tamanho);
    if (!dataUrl.startsWith(PREFIXO_DATA_URL_PNG)) throw new ErroDeLogo('ilegivel');
    if (bytesDoDataUrlPng(dataUrl) <= LOGO_BYTES_MAX_PNG) return { dataUrl, tamanho };
    tamanho = {
      largura: Math.max(1, Math.floor(tamanho.largura * LOGO_FATOR_REDUCAO_PNG)),
      altura: Math.max(1, Math.floor(tamanho.altura * LOGO_FATOR_REDUCAO_PNG)),
    };
    if (Math.min(tamanho.largura, tamanho.altura) < LOGO_LADO_MIN_PX) {
      throw new ErroDeLogo('ilegivel');
    }
  }
}

/**
 * Tamanho → bytes → validação → rasterização. Lança `ErroDeLogo` (mensagem do app; texto de erro
 * do navegador nunca é repassado).
 */
export async function prepararLogo(
  arquivo: Blob,
  ambiente: AmbienteRaster = AMBIENTE_NAVEGADOR,
): Promise<LogoDoc> {
  if (arquivo.size > LOGO_TAMANHO_MAX_BYTES) throw new ErroDeLogo('grande');

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await arquivo.arrayBuffer());
  } catch {
    throw new ErroDeLogo('ilegivel');
  }
  const { formato, dimensoes: declaradas } = validarBytesLogo(bytes);

  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: MIME_POR_FORMATO[formato] }),
  );
  try {
    const { dimensoes, fonte } = await comTempoMaximo((sinal) => ambiente.decodificar(url, sinal));
    const saida =
      formato === 'svg'
        ? // Vetorial: o declarado só dá a proporção; preenche a caixa (24×24 vira 400×400).
          encaixar(declaradas, LOGO_SAIDA_MAX_PX, { ampliar: true })
        : encaixar(tamanhoDoBitmap(dimensoes), LOGO_SAIDA_MAX_PX);
    const { dataUrl, tamanho } = pngQueCabe(ambiente, fonte, saida);
    return { dataUrl, largura: tamanho.largura, altura: tamanho.altura };
  } catch (erro) {
    throw erro instanceof ErroDeLogo ? erro : new ErroDeLogo('ilegivel');
  } finally {
    URL.revokeObjectURL(url);
  }
}
