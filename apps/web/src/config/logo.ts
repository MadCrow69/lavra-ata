/** Limites e opções da logo do cabeçalho (spec do Plano 04). Fonte única: UI, validação e mensagens leem daqui. */

/** Tamanho máximo do arquivo enviado (2 MB). */
export const LOGO_TAMANHO_MAX_BYTES = 2 * 1024 * 1024;

/** Menor lado aceito, em pixels (imagem menor vira um borrão no documento). */
export const LOGO_LADO_MIN_PX = 16;

/** Maior lado aceito na origem, em pixels; lido do cabeçalho do arquivo, antes de decodificar. */
export const LOGO_LADO_MAX_ORIGEM_PX = 6000;

/**
 * Maior área aceita na origem (largura × altura). O teto por lado sozinho deixa passar 6000 × 6000
 * (36 Mpx ≈ 144 MB decodificados): este limite fecha a bomba de descompressão.
 */
export const LOGO_PIXELS_MAX_ORIGEM = 25_000_000;

/**
 * Maior proporção (lado maior ÷ lado menor) aceita, em bitmap e em SVG. Fora disso a logo vira uma
 * faixa ilegível no cabeçalho e, no SVG, a escala até a caixa de saída gera um canvas de 1 px.
 */
export const LOGO_PROPORCAO_MAX = 20;

/** Caixa máxima da imagem rasterizada que vai para o documento. */
export const LOGO_SAIDA_MAX_PX = { largura: 1200, altura: 400 };

/** Tempo máximo, em ms, para o navegador decodificar a imagem. */
export const LOGO_TEMPO_MAX_MS = 5_000;

/** Dimensões usadas quando um SVG não declara largura, altura nem viewBox (padrão do navegador). */
export const LOGO_SVG_DIMENSOES_PADRAO = { largura: 300, altura: 150 };

/** Quantos bytes iniciais do arquivo são lidos para reconhecer um SVG. */
export const LOGO_SVG_BYTES_CABECALHO = 4096;

export const LOGO_ACCEPT =
  '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml';
