import { mask, validateOutput } from '@lavra/pii-br';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ATA_TYPES, camposFaltando, obterTipo } from '../ata-types/registry';
import { validarSchema } from '../ai/json-schema';
import { RESPONSAVEL_A_DEFINIR } from '../config/documento';
import { construirDocumento, contarPreencher } from '../document/build-model';
import { carregarRascunho, salvarRascunho } from '../domain/persistence';
import { schemaDaAta } from '../generation/output-schema';
import {
  CARREGADORES_EXEMPLO,
  ErroExemplo,
  MENSAGEM_ERRO_EXEMPLO,
  carregarExemplo,
  rascunhoDoExemplo,
} from './carregar';
import { CPF_EXEMPLO, TELEFONE_EXEMPLO } from './ficticios';
import type { Exemplo, SaidaExemplo } from './tipos';

const IDS = Object.keys(ATA_TYPES);

/** Lacunas `[PREENCHER: …]` esperadas no documento inteiro de cada exemplo (ruling S2). */
const LACUNAS_ESPERADAS: Record<string, number> = {
  corporativa: 0,
  cipa: 0,
  condominio: 1,
  'socios-ltda': 0,
};

/**
 * Seções com blocos em cada exemplo, na ordem do tipo. A corporativa tem as 6 (riscos incluído,
 * pelo brief); nos demais, toda seção do tipo tem conteúdo dito na transcrição.
 */
const SECOES_COM_CONTEUDO: Record<string, string[]> = {
  corporativa: ['resumo', 'discussao', 'decisoes', 'pendencias', 'riscos', 'proxima_reuniao'],
  cipa: [
    'abertura',
    'ata_anterior',
    'pendencias_anteriores',
    'discussao',
    'deliberacoes',
    'encerramento',
  ],
  condominio: ['abertura_instalacao', 'eleicao_mesa', 'ordem_do_dia', 'encerramento'],
  'socios-ltda': ['instalacao', 'deliberacoes', 'encerramento'],
};

/** Termos que só podem estar no resultado se foram ditos na transcrição. */
const TERMOS_DECLARADOS = /qu[óo]rum|un[âa]nim|maioria|consenso|\d+\s+votos?/gi;

/** Todo texto que a "IA" escreveu: blocos de todas as seções e os encaminhamentos. */
function textoDaSaida(saida: SaidaExemplo): string {
  return [
    ...Object.values(saida.secoes).flatMap((blocos) =>
      blocos.flatMap((b) => [b.texto, ...b.itens]),
    ),
    ...saida.encaminhamentos.flatMap((e) => [e.acao, e.responsavel, e.prazo]),
  ].join('\n');
}

afterEach(() => {
  sessionStorage.clear();
});

describe('carregarExemplo', () => {
  it('o registro tem pelo menos os quatro tipos (piso da varredura)', () => {
    expect(IDS.length).toBeGreaterThanOrEqual(4);
  });

  it.each(IDS)('%s: tem carregador e devolve o exemplo do próprio tipo', async (id) => {
    expect(Object.hasOwn(CARREGADORES_EXEMPLO, id)).toBe(true);
    expect((await carregarExemplo(id)).tipoId).toBe(id);
  });

  it('carregador que rejeita vira ErroExemplo, sem o texto do erro original', async () => {
    const falha = carregarExemplo('cipa', {
      cipa: () => Promise.reject(new Error('Failed to fetch dynamically imported module')),
    });

    await expect(falha).rejects.toBeInstanceOf(ErroExemplo);
    await expect(falha).rejects.toThrow(MENSAGEM_ERRO_EXEMPLO);
    await falha.catch((erro: unknown) => {
      expect((erro as Error).message).not.toContain('Failed to fetch');
      expect((erro as Error).cause).toBeUndefined();
    });
  });

  it('carregador que devolve o exemplo de outro tipo vira ErroExemplo', async () => {
    const outro = await carregarExemplo('corporativa');

    await expect(carregarExemplo('cipa', { cipa: () => Promise.resolve(outro) })).rejects.toThrow(
      MENSAGEM_ERRO_EXEMPLO,
    );
  });

  it.each(['xyz', 'constructor', '__proto__', ''])(
    'tipo sem carregador (%j) vira ErroExemplo',
    async (id) => {
      await expect(carregarExemplo(id)).rejects.toBeInstanceOf(ErroExemplo);
    },
  );

  it('a mensagem diz a causa e a ação', () => {
    expect(MENSAGEM_ERRO_EXEMPLO).toBe(
      'Não foi possível carregar o exemplo. Verifique a conexão e recarregue a página.',
    );
    expect(new ErroExemplo().message).toBe(MENSAGEM_ERRO_EXEMPLO);
  });
});

describe.each(IDS)('exemplo %s', (id) => {
  const tipo = obterTipo(id);
  let ex: Exemplo;

  // Carga única por tipo, pelo próprio carregador do app (import dinâmico).
  beforeAll(async () => {
    ex = await carregarExemplo(id);
  });

  it('o rascunho não tem nenhum campo faltando', () => {
    expect(camposFaltando(rascunhoDoExemplo(ex), tipo)).toEqual([]);
  });

  it('a saída passa no schema da IA e usa só seções do tipo', () => {
    const chaves = tipo.secoes.map((s) => s.chave);

    expect(validarSchema(ex.saida, schemaDaAta(tipo))).toEqual([]);
    expect(Object.keys(ex.saida.secoes).every((c) => chaves.includes(c))).toBe(true);
    expect(ex.saida.encaminhamentos.length).toBeGreaterThanOrEqual(2);
  });

  it('todo prazo em texto livre foi dito na transcrição (data ISO: conferida à mão)', () => {
    const transcricao = ex.transcricao.toLowerCase();
    const livres = ex.saida.encaminhamentos
      .map((e) => e.prazo)
      .filter((prazo) => !/^\d{4}-\d{2}-\d{2}$/.test(prazo));

    for (const prazo of livres) expect(transcricao).toContain(prazo.toLowerCase());
  });

  it('as seções com conteúdo são exatamente as esperadas para o tipo', () => {
    const comConteudo = Object.entries(ex.saida.secoes)
      .filter(([, blocos]) => blocos.length > 0)
      .map(([chave]) => chave);

    expect(comConteudo).toEqual(SECOES_COM_CONTEUDO[id]);
  });

  it('a saída passa na validação de marcadores (nenhum identificador novo)', () => {
    const { map } = mask(ex.transcricao);
    const relatorio = validateOutput(textoDaSaida(ex.saida), map, ex.transcricao);

    expect(relatorio).toEqual({
      ok: true,
      unknownMarkers: [],
      malformedMarkers: [],
      newIdentifiers: [],
    });
  });

  it('a transcrição cita o CPF e o telefone fictícios, e a prévia de privacidade os acha', () => {
    expect(ex.transcricao).toContain(CPF_EXEMPLO);
    expect(ex.transcricao).toContain(TELEFONE_EXEMPLO);

    const { map } = mask(ex.transcricao);
    expect(map.counters.CPF ?? 0).toBeGreaterThanOrEqual(1);
    expect(map.counters.TELEFONE ?? 0).toBeGreaterThanOrEqual(1);
    // O primeiro CPF do texto é o `CPF_EXEMPLO` (o `[CPF_1]` da prévia e do E2E).
    expect(map.markers['[CPF_1]']).toBe(CPF_EXEMPLO);
  });

  it('a transcrição tem de 15 a 30 falas no formato "Nome: fala"', () => {
    const falas = ex.transcricao.split('\n').filter((l) => l.trim() !== '');

    expect(falas.length).toBeGreaterThanOrEqual(15);
    expect(falas.length).toBeLessThanOrEqual(30);
    for (const fala of falas) expect(fala).toMatch(/^\p{L}[\p{L} .'-]*: \S/u);
  });

  it('participantes com ids únicos de prefixo fixo e nomes únicos', () => {
    const ids = ex.participantes.map((p) => p.id);
    const nomes = ex.participantes.map((p) => p.nome);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(nomes).size).toBe(nomes.length);
    for (const pid of ids) expect(pid).toMatch(new RegExp(`^exemplo-${id}-\\d{2}$`));
  });

  it('lacunas [PREENCHER] no documento inteiro só onde o exemplo as quer', () => {
    const modelo = construirDocumento(rascunhoDoExemplo(ex), tipo);

    expect(contarPreencher(modelo)).toBe(LACUNAS_ESPERADAS[id]);
  });

  it('nada calculado nem inventado: quórum, unanimidade, maioria, consenso e votos foram ditos', () => {
    const transcricao = ex.transcricao.toLowerCase();
    const termos = textoDaSaida(ex.saida).match(TERMOS_DECLARADOS) ?? [];

    for (const termo of termos) expect(transcricao).toContain(termo.toLowerCase());
  });

  it('nenhum texto fixo do tipo é escrito no resultado (vem do modelo)', () => {
    const saida = textoDaSaida(ex.saida);

    for (const fixo of Object.values(tipo.textosFixos ?? {})) expect(saida).not.toContain(fixo);
  });

  it('o rascunho sobrevive a salvar e carregar da sessão', () => {
    const r = rascunhoDoExemplo(ex);
    salvarRascunho(r);

    expect(carregarRascunho()).toEqual(r);
  });

  it('o rascunho é uma cópia: alterá-lo não altera o exemplo', () => {
    const r = rascunhoDoExemplo(ex);
    r.dados.data = '1999-01-01';
    r.pauta.push('x');
    const primeiro = r.participantes[0];
    if (primeiro) primeiro.extras.y = 'z';

    expect(ex.dados.data).not.toBe('1999-01-01');
    expect(ex.pauta).not.toContain('x');
    expect(ex.participantes[0]?.extras.y).toBeUndefined();
  });

  it('a logo é um SVG geométrico, com xmlns e viewBox, sem texto nem código', () => {
    expect(ex.logoSvg.startsWith('<svg')).toBe(true);
    expect(ex.logoSvg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(ex.logoSvg).toContain('viewBox');
    expect(ex.logoSvg).not.toMatch(/<script|<style|<text|href|\son\w+=/i);
  });
});

describe('rascunhoDoExemplo', () => {
  it('formato do rascunho: versão 1, tom formal, sem mapa, resultado normalizado', async () => {
    const ex = await carregarExemplo('corporativa');
    const r = rascunhoDoExemplo(ex);

    expect(r).toMatchObject({ versao: 1, tipoId: 'corporativa', tom: 'formal', mapa: null });
    expect(r.transcricao).toBe(ex.transcricao);
    expect(r.resultado).toMatchObject({ atribuicao: {}, avisos: {}, editadas: [] });
    expect(r.resultado?.encaminhamentos.map((e) => e.responsavel)).toContain(RESPONSAVEL_A_DEFINIR);
  });

  it('condomínio: o item sem resultado dito sai com a lacuna exata', async () => {
    const ex = await carregarExemplo('condominio');

    expect(textoDaSaida(ex.saida)).toContain('[PREENCHER: resultado da votação]');
  });
});
