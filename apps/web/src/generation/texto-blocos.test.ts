import { describe, expect, it } from 'vitest';
import type { Bloco } from '../domain/draft';
import { blocosParaTexto } from './prompt';
import { textoParaBlocos } from './texto-blocos';

const p = (texto: string): Bloco => ({ tipo: 'paragrafo', texto, itens: [] });
const l = (itens: string[], texto = ''): Bloco => ({ tipo: 'lista', texto, itens });

describe('textoParaBlocos', () => {
  it('parágrafos separados por linha em branco viram blocos de parágrafo', () => {
    expect(textoParaBlocos('Primeiro.\n\nSegundo.')).toEqual([p('Primeiro.'), p('Segundo.')]);
  });

  it('linhas com "- " viram itens de uma lista', () => {
    expect(textoParaBlocos('- Aprovar\n- Adiar')).toEqual([l(['Aprovar', 'Adiar'])]);
  });

  it('texto logo acima dos itens, sem linha em branco, é o texto da lista', () => {
    expect(textoParaBlocos('Ficou decidido:\n- Aprovar\n- Adiar')).toEqual([
      l(['Aprovar', 'Adiar'], 'Ficou decidido:'),
    ]);
  });

  it('com linha em branco entre o texto e os itens são dois blocos', () => {
    expect(textoParaBlocos('Ficou decidido:\n\n- Aprovar')).toEqual([
      p('Ficou decidido:'),
      l(['Aprovar']),
    ]);
  });

  it('linha de continuação junta-se ao item anterior', () => {
    expect(textoParaBlocos('- Aprovar o\nreembolso\n- Adiar')).toEqual([
      l(['Aprovar o reembolso', 'Adiar']),
    ]);
  });

  it('ignora excesso de linhas em branco, espaços nas pontas e CRLF', () => {
    expect(textoParaBlocos('\r\n  Um.  \r\n\r\n\r\n\r\nDois.\r\n\r\n')).toEqual([
      p('Um.'),
      p('Dois.'),
    ]);
  });

  it('item vazio ("- ") é descartado e texto vazio não gera bloco', () => {
    expect(textoParaBlocos('- \n- Algo')).toEqual([l(['Algo'])]);
    expect(textoParaBlocos('  \n\n ')).toEqual([]);
  });

  it('ida e volta: serializar e ler devolve os mesmos blocos', () => {
    const tipicos: Bloco[][] = [
      [p('Foi tratado o reembolso.')],
      [p('Abertura.'), l(['Aprovar o reembolso', 'Adiar a compra']), p('Encerramento.')],
      [l(['Item A', 'Item B'], 'Ficou decidido:'), p('Fim.')],
      [p('Linha 1\nLinha 2'), l(['Só um item'])],
    ];
    for (const blocos of tipicos) {
      expect(textoParaBlocos(blocosParaTexto(blocos))).toEqual(blocos);
    }
  });
});
