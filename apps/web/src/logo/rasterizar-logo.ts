import {
  LOGO_SAIDA_MAX_PX,
  LOGO_SVG_DIMENSOES_PADRAO,
  LOGO_TAMANHO_MAX_BYTES,
  LOGO_TEMPO_MAX_MS,
} from '../config/logo';
import { encaixar, type Dimensoes } from '../document/medidas';
import type { LogoDoc } from '../document/model';
import {
  dimensoesDeclaradasSvg,
  ErroDeLogo,
  validarBytesLogo,
  type FormatoLogo,
} from './validar-logo';

/**
 * Rasteriza a logo para PNG no navegador. Nada da imagem original segue adiante: SVG, JPEG e WebP
 * saem como PNG de um canvas, então o documento nunca carrega markup nem metadados da pessoa.
 *
 * Segurança do SVG: ele é só carregado como imagem (`<img>` com URL `blob:`), nunca inserido como
 * markup. Em contexto de imagem o navegador não executa script nem carrega recurso externo (MDN,
 * "SVG as an image"); `img-src blob:` já está na CSP. Um SVG com `foreignObject` contamina o
 * canvas e `toDataURL` lança `SecurityError`, tratado como imagem ilegível.
 */

export interface AmbienteRaster {
  decodificar: (url: string) => Promise<{ dimensoes: Dimensoes; fonte: CanvasImageSource }>;
  /** PNG em data URL (`data:image/png;base64,…`) da `fonte` desenhada em `saida`. */
  paraPng: (fonte: CanvasImageSource, saida: Dimensoes) => string;
}

export const AMBIENTE_NAVEGADOR: AmbienteRaster = {
  decodificar: async (url) => {
    const imagem = new Image();
    imagem.decoding = 'async';
    imagem.src = url;
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

const PREFIXO_PNG = 'data:image/png;base64,';

function comTempoMaximo<T>(promessa: Promise<T>): Promise<T> {
  return new Promise<T>((resolver, rejeitar) => {
    const relogio = setTimeout(() => {
      rejeitar(new ErroDeLogo('ilegivel'));
    }, LOGO_TEMPO_MAX_MS);
    promessa.then(
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

/**
 * Tamanho da imagem de origem. Bitmap: o que o navegador decodificou (0 = ilegível). SVG: o
 * declarado no texto (width/height ou viewBox), senão o do navegador, senão o padrão de 300×150.
 */
function tamanhoDeOrigem(
  formato: FormatoLogo,
  bytes: Uint8Array,
  decodificado: Dimensoes,
): Dimensoes {
  const valido = decodificado.largura > 0 && decodificado.altura > 0;
  if (formato !== 'svg') {
    if (!valido) throw new ErroDeLogo('ilegivel');
    return decodificado;
  }
  return (
    dimensoesDeclaradasSvg(bytes) ?? (valido ? decodificado : { ...LOGO_SVG_DIMENSOES_PADRAO })
  );
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
  const { formato } = validarBytesLogo(bytes);

  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: MIME_POR_FORMATO[formato] }),
  );
  try {
    const { dimensoes, fonte } = await comTempoMaximo(ambiente.decodificar(url));
    const natural = tamanhoDeOrigem(formato, bytes, dimensoes);
    const saida = encaixar(natural, LOGO_SAIDA_MAX_PX);
    const dataUrl = ambiente.paraPng(fonte, saida);
    if (!dataUrl.startsWith(PREFIXO_PNG)) throw new ErroDeLogo('ilegivel');
    return { dataUrl, largura: saida.largura, altura: saida.altura };
  } catch (erro) {
    throw erro instanceof ErroDeLogo ? erro : new ErroDeLogo('ilegivel');
  } finally {
    URL.revokeObjectURL(url);
  }
}
