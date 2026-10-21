import { describe, expect, it } from 'vitest';
import { corporativa } from '../ata-types/corporativa';
import { ATA_TYPES, colunasDeParticipantes } from '../ata-types/registry';
import type { AtaTypeDefinition } from '../ata-types/types';
import { LARGURA_UTIL_PT, RESPIRO_CELULA_PT, TIPOGRAFIA_DOCUMENTO } from '../config/documento';
import { largurasPorPeso } from '../document/larguras';
import { ROTULO_PRESENCA } from '../domain/draft';
import { larguraPt } from '../test/medir-texto';
import { TIPO_DE_TESTE } from '../test/tipo-de-teste';
import { larguraUtilDxa, largurasDxa } from './docx/medidas-docx';

type Dados = Record<string, string>;

const palavras = (texto: string): string[] => texto.split(/\s+/).filter((p) => p !== '');

/**
 * Todas as combinações dos campos `escolha` do tipo (cada um vazio ou com uma de suas opções): os
 * rótulos e a visibilidade das colunas podem depender de mais de um campo ao mesmo tempo.
 */
function variacoesDeDados(tipo: AtaTypeDefinition): Dados[] {
  return tipo.campos
    .filter((campo) => campo.tipo === 'escolha')
    .reduce<Dados[]>(
      (combinacoes, campo) =>
        combinacoes.flatMap((dados) =>
          ['', ...(campo.opcoes ?? []).map((o) => o.valor)].map((valor) => ({
            ...dados,
            [campo.id]: valor,
          })),
        ),
      [{}],
    );
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
  for (const dados of variacoesDeDados(tipo)) {
    const colunas = colunasDeParticipantes(tipo, dados);
    const larguras = largurasPorPeso(colunas.map((c) => c.peso));
    const dxa = largurasDxa(larguras, larguras.length);
    if (dxa.reduce((a, b) => a + b, 0) !== larguraUtilDxa()) {
      violacoes.push(`${tipo.id} ${JSON.stringify(dados)}: grade do DOCX não soma a largura útil`);
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
  });

  it('a corporativa mede coluna a coluna: 43 % · 29 % · 28 % do espaço útil', () => {
    const pesos = colunasDeParticipantes(corporativa, {}).map((c) => c.peso);
    expect(largurasPorPeso(pesos)).toEqual([43, 29, 28]);
  });
});
