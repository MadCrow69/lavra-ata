import { describe, expect, it } from 'vitest';
import { LIMITE_PARTICIPANTES } from '../../config/limits';
import { ROTULOS_FALANTE_GENERICO } from '../../config/falantes';
import {
  descreverAdicaoDeFalantes,
  ehRotuloGenerico,
  listarNomes,
  sugerirFalantes,
} from './falantes-da-transcricao';
import { normalizarBusca } from './lista-participantes';

const PESSOA = { singular: 'participante', plural: 'participantes' };
const nomes = (...lista: string[]) => lista.map((nome) => ({ nome }));

describe('sugerirFalantes', () => {
  it('devolve quem falou, um por pessoa, na grafia da primeira fala', () => {
    const texto = [
      'Ana Souza: Bom dia.',
      'Bruno Lima: Olá.',
      'ANA  SOUZA: De novo.',
      'Ana Souza: Outra vez.',
      'Carla Dias: Tchau.',
    ].join('\n');
    expect(sugerirFalantes(texto, [])).toEqual({
      falantes: ['Ana Souza', 'Bruno Lima', 'Carla Dias'],
      novos: ['Ana Souza', 'Bruno Lima', 'Carla Dias'],
    });
  });

  it('compara sem caixa, acento nem espaço extra, e NFC igual a NFD, dos dois lados', () => {
    const nfd = 'Jo\u0061\u0303o Prado'; // "João" decomposto
    const texto = [`${nfd}: oi`, 'helena duarte: oi', 'Íris Melo: oi'].join('\n');
    const existentes = nomes('João Prado', ' Helena   Duarte ', 'iris melo');
    expect(sugerirFalantes(texto, existentes)).toEqual({
      falantes: [nfd, 'helena duarte', 'Íris Melo'],
      novos: [],
    });
  });

  it('nomes parecidos mas diferentes não se juntam ("Ana" × "Ana Souza")', () => {
    const texto = ['Ana: oi', 'Ana Souza: oi'].join('\n');
    expect(sugerirFalantes(texto, nomes('Ana'))).toEqual({
      falantes: ['Ana', 'Ana Souza'],
      novos: ['Ana Souza'],
    });
  });

  it('caractere invisível no nome não cria uma segunda pessoa', () => {
    const texto = ['Ana Souza: oi', 'Ana\u200b Souza: oi'].join('\n');
    expect(sugerirFalantes(texto, []).falantes).toEqual(['Ana Souza']);
  });

  it('rótulos genéricos não viram participantes', () => {
    const texto = ['Desconhecido: oi', 'Speaker: oi', 'Ana Souza: oi', 'Participante: oi'].join(
      '\n',
    );
    expect(sugerirFalantes(texto, []).falantes).toEqual(['Ana Souza']);
  });

  it('sem falas no formato "Nome: fala", não há sugestão', () => {
    expect(sugerirFalantes('Vamos começar a reunião.', [])).toEqual({ falantes: [], novos: [] });
  });
});

describe('ehRotuloGenerico', () => {
  it.each(ROTULOS_FALANTE_GENERICO)('"%s" (e com número no fim) é genérico', (rotulo) => {
    expect(ehRotuloGenerico(rotulo)).toBe(true);
    expect(ehRotuloGenerico(`${rotulo.toUpperCase()} 1`)).toBe(true);
    expect(ehRotuloGenerico(`${rotulo} #12`)).toBe(true);
  });

  it('a lista em config está normalizada e sem repetição', () => {
    expect(ROTULOS_FALANTE_GENERICO.length).toBeGreaterThan(0);
    for (const rotulo of ROTULOS_FALANTE_GENERICO) expect(normalizarBusca(rotulo)).toBe(rotulo);
    expect(new Set(ROTULOS_FALANTE_GENERICO).size).toBe(ROTULOS_FALANTE_GENERICO.length);
  });

  it('acento e caixa não importam; nome de pessoa não é genérico', () => {
    expect(ehRotuloGenerico('Usuário 3')).toBe(true);
    expect(ehRotuloGenerico('Ana Souza')).toBe(false);
    expect(ehRotuloGenerico('Speaker Ana')).toBe(false);
    expect(ehRotuloGenerico('Pessoa Física')).toBe(false);
  });
});

describe('listarNomes', () => {
  it('junta com vírgula e "e"; acima do máximo resume em "e mais N"', () => {
    expect(listarNomes(['Ana'], 3)).toBe('Ana');
    expect(listarNomes(['Ana', 'Rui'], 3)).toBe('Ana e Rui');
    expect(listarNomes(['Ana', 'Rui', 'Iva'], 3)).toBe('Ana, Rui e Iva');
    expect(listarNomes(['Ana', 'Rui', 'Iva', 'Léo', 'Bia'], 3)).toBe('Ana, Rui, Iva e mais 2');
  });
});

describe('descreverAdicaoDeFalantes', () => {
  it('diz quantos entraram, onde, e quantos já estavam', () => {
    expect(descreverAdicaoDeFalantes({ adicionados: 3, jaNaLista: 0, ignorados: 0 }, PESSOA)).toBe(
      '3 participantes adicionados ao bloco 3.',
    );
    expect(descreverAdicaoDeFalantes({ adicionados: 2, jaNaLista: 1, ignorados: 0 }, PESSOA)).toBe(
      '2 participantes adicionados ao bloco 3 (1 já estava na lista).',
    );
    expect(
      descreverAdicaoDeFalantes(
        { adicionados: 1, jaNaLista: 2, ignorados: 0 },
        { singular: 'sócio', plural: 'sócios' },
      ),
    ).toBe('1 sócio adicionado ao bloco 3 (2 já estavam na lista).');
  });

  it('no teto, diz quantos ficaram de fora e qual é o limite', () => {
    expect(descreverAdicaoDeFalantes({ adicionados: 1, jaNaLista: 0, ignorados: 2 }, PESSOA)).toBe(
      `1 participante adicionado ao bloco 3. 2 nomes ignorados: o limite é ${String(LIMITE_PARTICIPANTES)} participantes.`,
    );
    expect(descreverAdicaoDeFalantes({ adicionados: 0, jaNaLista: 0, ignorados: 4 }, PESSOA)).toBe(
      `Nenhum nome foi adicionado. 4 nomes ignorados: o limite é ${String(LIMITE_PARTICIPANTES)} participantes.`,
    );
  });
});
