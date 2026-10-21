import { describe, expect, it } from 'vitest';
import { RODAPE_PAGINADO } from '../../config/documento';
import type { DocumentModel } from '../../document/model';
import { modeloDeVolume, NOME_DECOMPOSTO } from '../../test/documento-volume';
import {
  caracteresSemFonte,
  FAIXAS_FONTE,
  FONTES_PDF,
  prepararTextoPdf,
  separarPorFonte,
  SUBSTITUICOES_PDF,
  type FamiliaPdf,
} from './cobertura';
import { COBERTURA_GERADA } from './cobertura-gerada';

const cp = (...pontos: number[]) => String.fromCodePoint(...pontos);

/** O subset (latin/ext) da família desenha o ponto de código? */
function desenha(familia: FamiliaPdf, ponto: number): boolean {
  const { latin, ext } = FAIXAS_FONTE[familia];
  return [...latin, ...ext].some(([a, b]) => ponto >= a && ponto <= b);
}

function modeloCom(texto: string, extras: Partial<DocumentModel> = {}): DocumentModel {
  return {
    titulo: 'Ata',
    cabecalho: { logo: null, linhas: [] },
    blocos: [{ tipo: 'paragrafo', partes: [{ texto }] }],
    rodape: RODAPE_PAGINADO,
    rodapeInterno: null,
    ...extras,
  };
}

describe('cobertura vem dos glifos reais (cobertura-gerada.ts)', () => {
  it('FAIXAS_FONTE é a cobertura gerada do cmap dos .woff embutidos', () => {
    expect(FAIXAS_FONTE).toBe(COBERTURA_GERADA);
  });

  it('o que a ata em pt-BR usa está desenhado no corpo e no título', () => {
    const ptBr = 'ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúçºª—–“”‘’•…€%';
    for (const familia of ['corpo', 'titulo'] as const) {
      for (const c of ptBr) expect(desenha(familia, c.codePointAt(0) ?? 0), c).toBe(true);
    }
  });

  it('o que o unicode-range declara mas não tem glifo NÃO conta como coberto', () => {
    for (const ponto of [0x2010, 0x2011, 0x202f, 0x2030, 0x00ad]) {
      expect(desenha('corpo', ponto), ponto.toString(16)).toBe(false);
    }
  });

  it('nomes das famílias registradas no pdfmake', () => {
    expect(FONTES_PDF).toEqual({
      corpo: { latin: 'Inter', ext: 'InterExt' },
      titulo: { latin: 'SourceSerif', ext: 'SourceSerifExt' },
    });
  });
});

describe('prepararTextoPdf', () => {
  it('normaliza em NFC', () => {
    expect(prepararTextoPdf(NOME_DECOMPOSTO)).toBe('João Decomposto');
  });

  it('remove formatação invisível (Cf) e seletores de variação', () => {
    const sujo = `a${cp(0x200b)}b${cp(0x200e)}c${cp(0x2068)}d${cp(0x2069)}e${cp(0x00ad)}f${cp(0xfeff)}g${cp(0x2764, 0xfe0f)}`;
    expect(prepararTextoPdf(sujo)).toBe(`abcdefg${cp(0x2764)}`);
  });

  it('troca hífen inquebrável, espaço fino inquebrável e espaços tipográficos', () => {
    expect(prepararTextoPdf(`D${cp(0x2011)}1 e 50${cp(0x202f)}%`)).toBe(`D-1 e 50${cp(0x00a0)}%`);
    expect(prepararTextoPdf(`a${cp(0x2003)}b${cp(0x2009)}c`)).toBe(`a b${cp(0x2009)}c`);
  });

  it('cada troca vai de algo sem glifo para algo desenhado nas duas famílias', () => {
    for (const [origem, destino] of SUBSTITUICOES_PDF) {
      // Nenhuma família desenha a origem (basta uma desenhar para a troca ser desnecessária).
      expect(desenha('corpo', origem) || desenha('titulo', origem), origem.toString(16)).toBe(
        false,
      );
      for (const c of destino) {
        if (c === '\n') continue;
        const ponto = c.codePointAt(0) ?? 0;
        expect(desenha('corpo', ponto) && desenha('titulo', ponto), ponto.toString(16)).toBe(true);
      }
    }
  });
});

describe('separarPorFonte', () => {
  it('texto pt-BR com pontuação tipográfica fica num trecho só, na fonte latin', () => {
    expect(separarPorFonte('Ação, coração, João — “ok” • 50%', 'corpo')).toEqual([
      { text: 'Ação, coração, João — “ok” • 50%', font: 'Inter' },
    ]);
  });

  it('letra latin-ext vai para a segunda família; o resto continua junto', () => {
    expect(separarPorFonte('Łukasz', 'corpo')).toEqual([
      { text: 'Ł', font: 'InterExt' },
      { text: 'ukasz', font: 'Inter' },
    ]);
    expect(separarPorFonte('Żółć', 'corpo')).toEqual([
      { text: 'Ż', font: 'InterExt' },
      { text: 'ó', font: 'Inter' },
      { text: 'łć', font: 'InterExt' },
    ]);
  });

  it('normaliza em NFC: o acento decomposto (NFD) sai composto e na fonte latin', () => {
    expect(separarPorFonte('João'.normalize('NFD'), 'corpo')).toEqual([
      { text: 'João', font: 'Inter' },
    ]);
  });

  it('a família do título usa SourceSerif e SourceSerifExt', () => {
    expect(separarPorFonte('Ata — Łódź', 'titulo')).toEqual([
      { text: 'Ata — ', font: 'SourceSerif' },
      { text: 'Ł', font: 'SourceSerifExt' },
      { text: 'ód', font: 'SourceSerif' },
      { text: 'ź', font: 'SourceSerifExt' },
    ]);
  });

  it('caractere fora das duas faixas fica na fonte latin (avisado antes de baixar)', () => {
    expect(separarPorFonte('aЖ😀b', 'corpo')).toEqual([{ text: 'aЖ😀b', font: 'Inter' }]);
  });

  it('texto vazio → nenhum trecho', () => {
    expect(separarPorFonte('', 'corpo')).toEqual([]);
  });
});

describe('caracteresSemFonte', () => {
  it('lista por ponto de código (não metade UTF-16), sem repetir, sem espaço nem controle', () => {
    expect(caracteresSemFonte(modeloCom('Ж😀Ж\n\t'))).toEqual(['Ж', '😀']);
  });

  it('ignora invisíveis (U+200B–U+200D, U+FE0E, U+FE0F, U+2060)', () => {
    expect(caracteresSemFonte(modeloCom('a\u200Bb\u200Cc\u200Dd\uFE0Ee\uFE0Ff\u2060g'))).toEqual(
      [],
    );
  });

  it('normaliza em NFC antes de conferir: "João" decomposto não acusa o til solto', () => {
    expect(caracteresSemFonte(modeloCom(NOME_DECOMPOSTO))).toEqual([]);
  });

  it('confere título, cabeçalho e tabelas; ignora o rodapé interno (não é impresso)', () => {
    const modelo = modeloCom('ok', {
      titulo: 'Ata 中',
      cabecalho: { logo: null, linhas: ['Linha Ω'] },
      blocos: [{ tipo: 'tabela', colunas: ['Nome'], linhas: [['Ð', 'א']] }],
      rodapeInterno: 'Минута',
    });
    expect(caracteresSemFonte(modelo)).toEqual(['中', 'Ω', 'א']);
  });

  it('acusa o que a fonte não desenha mesmo dentro do unicode-range declarado ("‰")', () => {
    expect(caracteresSemFonte(modeloCom('Margem de 5‰'))).toEqual(['‰']);
  });

  it('não acusa o que o PDF troca ou descarta (hífen inquebrável, isolamento bidi, hífen suave)', () => {
    const texto = `D${cp(0x2011)}1 ${cp(0x2068)}Nome${cp(0x2069)} co${cp(0x00ad)}operação 50${cp(0x202f)}%`;
    expect(caracteresSemFonte(modeloCom(texto))).toEqual([]);
  });

  it('título confere na família serifada; o corpo, só na do corpo', () => {
    // U+012C (Ĭ): o Inter desenha, o Source Serif 4 embutido não.
    const breve = cp(0x012c);
    expect(desenha('corpo', 0x012c)).toBe(true);
    expect(desenha('titulo', 0x012c)).toBe(false);
    expect(caracteresSemFonte(modeloCom(`Nome ${breve}`))).toEqual([]);
    expect(caracteresSemFonte(modeloCom('ok', { titulo: `Ata ${breve}` }))).toEqual([breve]);
  });

  it('o rascunho de volume (pt-BR, latin-ext e NFD) não tem caractere sem fonte', () => {
    expect(
      caracteresSemFonte(modeloDeVolume({ participantes: 200, encaminhamentos: 200 })),
    ).toEqual([]);
  });
});
