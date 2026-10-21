import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LOGO_LADO_MAX_ORIGEM_PX,
  LOGO_LADO_MIN_PX,
  LOGO_PIXELS_MAX_ORIGEM,
  LOGO_TAMANHO_MAX_BYTES,
} from '../config/logo';
import {
  bytesGif,
  bytesJpeg,
  bytesPng,
  bytesTexto,
  bytesWebpVp8,
  bytesWebpVp8l,
  bytesWebpVp8x,
} from '../test/bytes-logo';
import {
  detectarFormato,
  dimensoesDeclaradasSvg,
  ErroDeLogo,
  lerDimensoes,
  MENSAGEM_ERRO_LOGO,
  validarBytesLogo,
} from './validar-logo';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';

function motivoDe(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof ErroDeLogo ? e.motivo : 'outro erro';
  }
  return undefined;
}

describe('detectarFormato (pela assinatura, nunca pela extensão)', () => {
  it('reconhece PNG, JPEG e WebP', () => {
    expect(detectarFormato(bytesPng(10, 10))).toBe('png');
    expect(detectarFormato(bytesJpeg(10, 10))).toBe('jpeg');
    expect(detectarFormato(bytesWebpVp8x(10, 10))).toBe('webp');
  });

  it('reconhece SVG, inclusive com BOM, <?xml, comentário e DOCTYPE antes', () => {
    expect(detectarFormato(bytesTexto(SVG))).toBe('svg');
    expect(detectarFormato(bytesTexto('﻿  \n' + SVG))).toBe('svg');
    const longo =
      '<?xml version="1.0" encoding="UTF-8"?>\n<!-- gerado por um editor -->\n' +
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' +
      SVG;
    expect(detectarFormato(bytesTexto(longo))).toBe('svg');
    expect(detectarFormato(bytesTexto('<svg>'))).toBe('svg');
  });

  it('reconhece DOCTYPE com subconjunto interno', () => {
    expect(detectarFormato(bytesTexto('<!DOCTYPE svg [ <!ENTITY a "b"> ]>' + SVG))).toBe('svg');
  });

  it('recusa GIF (mesmo que o arquivo se chame .png), HTML e texto', () => {
    expect(detectarFormato(bytesGif())).toBeNull();
    expect(detectarFormato(bytesTexto('<html><svg></svg></html>'))).toBeNull();
    expect(detectarFormato(bytesTexto('<!DOCTYPE html><html></html>'))).toBeNull();
    expect(detectarFormato(bytesTexto('<svgfoo></svgfoo>'))).toBeNull();
    expect(detectarFormato(bytesTexto('olá'))).toBeNull();
    expect(detectarFormato(new Uint8Array())).toBeNull();
  });

  it('recusa RIFF que não é WebP e PNG truncado', () => {
    const wave = Uint8Array.from([...bytesTexto('RIFF'), 0, 0, 0, 0, ...bytesTexto('WAVE')]);
    expect(detectarFormato(wave)).toBeNull();
    expect(detectarFormato(bytesPng(10, 10).slice(0, 7))).toBeNull();
  });

  it('só olha os primeiros 4096 bytes para o SVG', () => {
    expect(detectarFormato(bytesTexto('<!-- ' + 'x'.repeat(5000) + ' -->' + SVG))).toBeNull();
  });
});

describe('lerDimensoes', () => {
  it('PNG pelo IHDR', () => {
    expect(lerDimensoes(bytesPng(800, 200), 'png')).toEqual({ largura: 800, altura: 200 });
  });

  it('JPEG, percorrendo o APP1 até o SOF', () => {
    expect(lerDimensoes(bytesJpeg(640, 480, { app1: true }), 'jpeg')).toEqual({
      largura: 640,
      altura: 480,
    });
    expect(lerDimensoes(bytesJpeg(640, 480), 'jpeg')).toEqual({ largura: 640, altura: 480 });
  });

  it('WebP VP8X, VP8 e VP8L', () => {
    expect(lerDimensoes(bytesWebpVp8x(3000, 1000), 'webp')).toEqual({
      largura: 3000,
      altura: 1000,
    });
    expect(lerDimensoes(bytesWebpVp8(320, 200), 'webp')).toEqual({ largura: 320, altura: 200 });
    expect(lerDimensoes(bytesWebpVp8l(1234, 567), 'webp')).toEqual({ largura: 1234, altura: 567 });
  });

  it('devolve null com cabeçalho truncado ou sem marcador de tamanho', () => {
    expect(lerDimensoes(bytesPng(10, 10).slice(0, 20), 'png')).toBeNull();
    expect(lerDimensoes(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), 'jpeg')).toBeNull();
    expect(lerDimensoes(bytesJpeg(10, 10).slice(0, 8), 'jpeg')).toBeNull();
    expect(lerDimensoes(bytesWebpVp8x(10, 10).slice(0, 26), 'webp')).toBeNull();
  });

  it('JPEG: ignora C4, C8 e CC (não são quadros) e segmento com tamanho inválido', () => {
    const c4 = Uint8Array.from([0xff, 0xd8, 0xff, 0xc4, 0, 4, 0, 0, 0xff, 0xd9]);
    expect(lerDimensoes(c4, 'jpeg')).toBeNull();
    const invalido = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 1, 2, 3]);
    expect(lerDimensoes(invalido, 'jpeg')).toBeNull();
  });
});

describe('dimensoesDeclaradasSvg', () => {
  it('usa width e height quando ambos são números (com ou sem px)', () => {
    expect(dimensoesDeclaradasSvg(bytesTexto('<svg width="120" height="40px"></svg>'))).toEqual({
      largura: 120,
      altura: 40,
    });
  });

  it('sem width/height usa o viewBox', () => {
    expect(
      dimensoesDeclaradasSvg(bytesTexto('<svg viewBox="0 0 2400 800" xmlns="x"></svg>')),
    ).toEqual({ largura: 2400, altura: 800 });
  });

  it('em porcentagem usa o viewBox; sem nada declarado devolve null', () => {
    const emPorcentagem = "<svg width='100%' height='100%' viewBox='0,0,50,25'></svg>";
    expect(dimensoesDeclaradasSvg(bytesTexto(emPorcentagem))).toEqual({ largura: 50, altura: 25 });
    expect(dimensoesDeclaradasSvg(bytesTexto('<svg></svg>'))).toBeNull();
    expect(dimensoesDeclaradasSvg(bytesTexto('<svg viewBox="0 0 0 0"></svg>'))).toBeNull();
  });

  it('não confunde stroke-width com width', () => {
    const svg = '<svg stroke-width="9" viewBox="0 0 10 20"></svg>';
    expect(dimensoesDeclaradasSvg(bytesTexto(svg))).toEqual({ largura: 10, altura: 20 });
  });
});

describe('validarBytesLogo', () => {
  it('aceita PNG, JPEG, WebP e SVG válidos', () => {
    expect(validarBytesLogo(bytesPng(800, 200))).toEqual({
      formato: 'png',
      dimensoes: { largura: 800, altura: 200 },
    });
    expect(validarBytesLogo(bytesJpeg(640, 480, { app1: true })).formato).toBe('jpeg');
    expect(validarBytesLogo(bytesWebpVp8x(3000, 1000)).formato).toBe('webp');
    expect(validarBytesLogo(bytesTexto(SVG))).toEqual({ formato: 'svg', dimensoes: null });
  });

  it('0 bytes: vazio', () => {
    expect(motivoDe(() => validarBytesLogo(new Uint8Array()))).toBe('vazio');
  });

  it('acima do tamanho máximo: grande', () => {
    const grande = new Uint8Array(LOGO_TAMANHO_MAX_BYTES + 1);
    expect(motivoDe(() => validarBytesLogo(grande))).toBe('grande');
  });

  it('GIF e HTML disfarçado: formato', () => {
    expect(motivoDe(() => validarBytesLogo(bytesGif()))).toBe('formato');
    expect(motivoDe(() => validarBytesLogo(bytesTexto('<html><svg></svg></html>')))).toBe(
      'formato',
    );
  });

  it('PNG de 2 KB que declara 20000×20000 (bomba): dimensoes', () => {
    const bomba = bytesPng(20000, 20000);
    expect(bomba.length).toBeLessThan(2048);
    expect(motivoDe(() => validarBytesLogo(bomba))).toBe('dimensoes');
  });

  it('lado dentro do teto, mas área acima do limite de pixels: dimensoes', () => {
    const lado = LOGO_LADO_MAX_ORIGEM_PX;
    expect(lado * lado).toBeGreaterThan(LOGO_PIXELS_MAX_ORIGEM);
    expect(motivoDe(() => validarBytesLogo(bytesPng(lado, lado)))).toBe('dimensoes');
    expect(validarBytesLogo(bytesPng(lado, 4000)).dimensoes).toEqual({
      largura: lado,
      altura: 4000,
    });
  });

  it('lado abaixo do mínimo, zero ou acima do teto: dimensoes', () => {
    expect(motivoDe(() => validarBytesLogo(bytesPng(8, 8)))).toBe('dimensoes');
    expect(motivoDe(() => validarBytesLogo(bytesPng(LOGO_LADO_MIN_PX - 1, 100)))).toBe('dimensoes');
    expect(validarBytesLogo(bytesPng(LOGO_LADO_MIN_PX, LOGO_LADO_MIN_PX)).formato).toBe('png');
    expect(motivoDe(() => validarBytesLogo(bytesPng(0, 100)))).toBe('dimensoes');
    expect(motivoDe(() => validarBytesLogo(bytesPng(LOGO_LADO_MAX_ORIGEM_PX + 1, 100)))).toBe(
      'dimensoes',
    );
  });

  it('imagem reconhecida mas sem tamanho legível: ilegivel', () => {
    expect(motivoDe(() => validarBytesLogo(bytesPng(10, 10).slice(0, 20)))).toBe('ilegivel');
  });

  it('a mensagem do erro é a do motivo', () => {
    try {
      validarBytesLogo(new Uint8Array());
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErroDeLogo);
      expect((e as ErroDeLogo).message).toBe(MENSAGEM_ERRO_LOGO.vazio);
    }
  });
});

describe('MENSAGEM_ERRO_LOGO', () => {
  afterEach(() => {
    vi.doUnmock('../config/logo');
    vi.resetModules();
  });

  it('texto em pt-BR com causa e ação', () => {
    expect(MENSAGEM_ERRO_LOGO).toEqual({
      vazio: 'O arquivo da logo está vazio. Escolha outra imagem.',
      grande: 'A logo passa de 2 MB. Reduza a imagem ou exporte em PNG menor.',
      formato: 'Formato de logo não aceito. Envie PNG, JPEG, WebP ou SVG.',
      dimensoes:
        'A logo tem dimensões fora do aceito (de 16 a 6.000 pixels por lado). Redimensione a imagem.',
      ilegivel:
        'Não foi possível ler esta imagem. Se for SVG, exporte a logo em PNG e envie de novo.',
    });
  });

  it('trocar os limites troca o texto (nada chumbado)', async () => {
    const real = await vi.importActual<typeof import('../config/logo')>('../config/logo');
    vi.resetModules();
    vi.doMock('../config/logo', () => ({
      ...real,
      LOGO_TAMANHO_MAX_BYTES: 5 * 1024 * 1024,
      LOGO_LADO_MIN_PX: 32,
      LOGO_LADO_MAX_ORIGEM_PX: 12_000,
    }));
    const { MENSAGEM_ERRO_LOGO: alterada } = await import('./validar-logo');
    expect(alterada.grande).toContain('5 MB');
    expect(alterada.grande).not.toContain('2 MB');
    expect(alterada.dimensoes).toContain('de 32 a 12.000 pixels');
  });
});
