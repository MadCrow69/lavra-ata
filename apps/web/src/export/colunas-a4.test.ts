import { describe, expect, it } from 'vitest';
import { cipa } from '../ata-types/cipa';
import { corporativa } from '../ata-types/corporativa';
import { condominio } from '../ata-types/condominio';
import {
  ATA_TYPES,
  colunasDeParticipantes,
  ehObrigatorio,
  type ColunaParticipante,
} from '../ata-types/registry';
import { sociosLtda } from '../ata-types/socios-ltda';
import type { AtaTypeDefinition, CampoDef } from '../ata-types/types';
import { LARGURA_UTIL_PT, RESPIRO_CELULA_PT, TIPOGRAFIA_DOCUMENTO } from '../config/documento';
import { colunasDoDocumento } from '../document/build-model';
import { largurasPorPeso } from '../document/larguras';
import { ROTULO_PRESENCA, type Participante } from '../domain/draft';
import { larguraPt } from '../test/medir-texto';
import { TIPO_DE_TESTE } from '../test/tipo-de-teste';
import { larguraUtilDxa, largurasDxa } from './docx/medidas-docx';

type Dados = Record<string, string>;

const palavras = (texto: string): string[] => texto.split(/\s+/).filter((p) => p !== '');

/** Combinações dos campos dados (cada um vazio ou com uma de suas opções). */
function combinacoes(campos: readonly CampoDef[]): Dados[] {
  return campos.reduce<Dados[]>(
    (todas, campo) =>
      todas.flatMap((dados) =>
        ['', ...(campo.opcoes ?? []).map((o) => o.valor)].map((valor) => ({
          ...dados,
          [campo.id]: valor,
        })),
      ),
    [{}],
  );
}

/** Ids que `visivelSe`/`rotuloPor` dos extras de participante leem para esses `dados`. */
function idsLidos(tipo: AtaTypeDefinition, dados: Dados): Set<string> {
  const lidos = new Set<string>();
  const espiao = new Proxy(dados, {
    get(alvo, chave) {
      if (typeof chave === 'string') lidos.add(chave);
      return typeof chave === 'string' ? alvo[chave] : undefined;
    },
  });
  for (const campo of tipo.camposParticipante) {
    campo.visivelSe?.(espiao);
    campo.rotuloPor?.(espiao);
  }
  return lidos;
}

/**
 * As colunas da tabela de participantes só mudam com o que o `visivelSe` e o `rotuloPor` dos
 * extras leem. LIMITE: combina só os campos `escolha` que algum deles lê (descobertos por ponto
 * fixo — uma leitura condicional, como `a === 'x' && b`, aparece quando `a` vale `x`), em vez de
 * todos os campos do tipo: o produto fica do tamanho das dependências reais, não do formulário
 * (Ltda e condomínio têm muitas escolhas que não mexem nas colunas). Sem dependência: `[{}]`.
 */
function variacoesDeDados(tipo: AtaTypeDefinition): Dados[] {
  const escolhas = tipo.campos.filter((c) => c.tipo === 'escolha');
  let ids = new Set<string>();
  for (;;) {
    const variacoes = combinacoes(escolhas.filter((c) => ids.has(c.id)));
    const novos = new Set(ids);
    for (const dados of variacoes) for (const id of idsLidos(tipo, dados)) novos.add(id);
    if (novos.size === ids.size) return variacoes;
    ids = novos;
  }
}

/** Todos os subconjuntos de `itens` (inclusive o vazio e o completo). */
function subconjuntos<T>(itens: readonly T[]): T[][] {
  return itens.reduce<T[][]>((todos, item) => [...todos, ...todos.map((s) => [...s, item])], [[]]);
}

/**
 * Colunas que o DOCUMENTO pode ter com esses `dados`: o documento omite a coluna opcional (papel
 * ou extra não obrigatório) que ninguém preencheu (`colunasDoDocumento`), e as larguras se
 * redistribuem. Uma variação por subconjunto de opcionais preenchidas, pela função real.
 */
function colunasPossiveisNoDocumento(
  tipo: AtaTypeDefinition,
  dados: Dados,
): ColunaParticipante[][] {
  const opcionais = colunasDeParticipantes(tipo, dados).filter(
    (c) => c.id === 'papel' || (c.campo !== null && !ehObrigatorio(c.campo, dados)),
  );
  return subconjuntos(opcionais).map((preenchidas) => {
    const ids = new Set(preenchidas.map((c) => c.id));
    const pessoa: Participante = {
      id: 'p1',
      nome: 'Pessoa',
      papel: ids.has('papel') ? 'Valor' : '',
      presenca: 'presente',
      justificativa: '',
      extras: Object.fromEntries(
        [...ids].filter((id) => id !== 'papel').map((id) => [id, 'Valor']),
      ),
    };
    return colunasDoDocumento(tipo, dados, [pessoa]);
  });
}

interface Resultado {
  colunasVerificadas: number;
  violacoes: string[];
}

/**
 * Toda palavra do cabeçalho (negrito) e do conteúdo possível da coluna (rótulos de opção e de
 * presença, normal) cabe na largura da coluna da tabela de participantes, já sem o respiro da
 * célula: palavra mais larga que a coluna estoura ou é cortada no PDF e no DOCX.
 */
function conferirTipo(tipo: AtaTypeDefinition): Resultado {
  const violacoes: string[] = [];
  let colunasVerificadas = 0;
  for (const dados of variacoesDeDados(tipo))
    for (const colunas of colunasPossiveisNoDocumento(tipo, dados)) {
      const larguras = largurasPorPeso(colunas.map((c) => c.peso));
      const dxa = largurasDxa(larguras, larguras.length);
      if (dxa.reduce((a, b) => a + b, 0) !== larguraUtilDxa()) {
        violacoes.push(
          `${tipo.id} ${JSON.stringify(dados)}: grade do DOCX não soma a largura útil`,
        );
      }
      colunas.forEach((coluna, i) => {
        colunasVerificadas += 1;
        const util = ((larguras[i] ?? 0) / 100) * LARGURA_UTIL_PT - RESPIRO_CELULA_PT;
        const conteudo = [
          ...(coluna.id === 'presenca' ? Object.values(ROTULO_PRESENCA) : []),
          ...(coluna.campo?.opcoes ?? []).map((o) => o.rotulo),
        ];
        const medidas = [
          ...palavras(coluna.rotulo).map((p) => ({ p, negrito: true })),
          ...conteudo.flatMap(palavras).map((p) => ({ p, negrito: false })),
        ];
        for (const { p, negrito } of medidas) {
          const largura = larguraPt(p, TIPOGRAFIA_DOCUMENTO.tabelaPt, negrito);
          if (largura > util) {
            violacoes.push(
              `${tipo.id} ${JSON.stringify(dados)}: “${p}” (${largura.toFixed(1)} pt) não cabe na coluna “${coluna.rotulo}” (${util.toFixed(1)} pt)`,
            );
          }
        }
      });
    }
  return { colunasVerificadas, violacoes };
}

describe('colunas de participantes cabem no A4 (PDF e DOCX)', () => {
  it('há tipos registrados para conferir', () => {
    expect(Object.keys(ATA_TYPES).length).toBeGreaterThanOrEqual(1);
  });

  for (const tipo of Object.values(ATA_TYPES)) {
    it(`${tipo.id}: nenhuma palavra de cabeçalho ou de opção é mais larga que a coluna`, () => {
      const { colunasVerificadas, violacoes } = conferirTipo(tipo);
      // Piso: nunca passa vazio.
      expect(colunasVerificadas).toBeGreaterThanOrEqual(3);
      expect(violacoes).toEqual([]);
    });
  }

  it('o tipo de teste (cinco colunas, com peso próprio) também cabe', () => {
    const { colunasVerificadas, violacoes } = conferirTipo(TIPO_DE_TESTE);
    expect(colunasVerificadas).toBeGreaterThanOrEqual(3);
    expect(violacoes).toEqual([]);
  });

  it('a guarda reprova uma coluna estreita demais (não passa no vazio)', () => {
    const estreito: AtaTypeDefinition = {
      ...TIPO_DE_TESTE,
      camposParticipante: TIPO_DE_TESTE.camposParticipante.map((c) =>
        c.id === 'vinculo' ? { ...c, peso: 0.2 } : c,
      ),
    };
    const { violacoes } = conferirTipo(estreito);
    expect(violacoes.some((v) => v.includes('Proprietário(a)'))).toBe(true);
  });

  it('a guarda combina os campos de escolha (rótulo que depende de dois campos ao mesmo tempo)', () => {
    const PALAVRA_LONGA = 'Representatividadeextraordinária';
    const combinado: AtaTypeDefinition = {
      ...TIPO_DE_TESTE,
      camposParticipante: TIPO_DE_TESTE.camposParticipante.map((c) =>
        c.id === 'vinculo'
          ? {
              ...c,
              rotuloPor: (dados: Dados) =>
                dados.natureza === 'extraordinaria' && dados.modalidade === 'hibrida'
                  ? PALAVRA_LONGA
                  : c.rotulo,
            }
          : c,
      ),
    };
    const { violacoes } = conferirTipo(combinado);
    expect(violacoes.some((v) => v.includes(PALAVRA_LONGA))).toBe(true);
    // Limite: só natureza e modalidade são lidas (3 × 3 com o vazio); `codigo` etc. ficam fora.
    expect(variacoesDeDados(combinado)).toHaveLength(9);
  });

  it('Ltda: as variações cobrem os rótulos em percentual e em quotas (o modo muda a coluna)', () => {
    const variacoes = variacoesDeDados(sociosLtda);
    expect(variacoes.map((d) => d.modo_capital ?? '').sort()).toEqual(['', 'percentual', 'quotas']);
    const rotulos = new Set(
      variacoes.flatMap((d) => colunasDeParticipantes(sociosLtda, d).map((c) => c.rotulo)),
    );
    for (const rotulo of ['Participação (%)', 'Quotas', 'Representado(a) por']) {
      expect(rotulos.has(rotulo), rotulo).toBe(true);
    }
    expect(conferirTipo(sociosLtda).violacoes).toEqual([]);
  });

  it('cobre as colunas que o documento omite: condomínio com e sem “Fração ideal”', () => {
    const conjuntos = colunasPossiveisNoDocumento(condominio, {}).map((cs) =>
      cs.map((c) => c.rotulo).join(' | '),
    );
    expect(conjuntos.sort()).toEqual([
      'Nome | Unidade | Vínculo | Fração ideal | Presença',
      'Nome | Unidade | Vínculo | Presença',
    ]);
  });

  it('limite do produto: tipo cujas colunas não dependem dos dados tem uma variação só', () => {
    expect(variacoesDeDados(cipa)).toEqual([{}]);
  });

  it('a corporativa mede coluna a coluna: 43 % · 29 % · 28 % do espaço útil', () => {
    const pesos = colunasDeParticipantes(corporativa, {}).map((c) => c.peso);
    expect(largurasPorPeso(pesos)).toEqual([43, 29, 28]);
  });
});
