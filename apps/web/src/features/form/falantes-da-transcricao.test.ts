import { describe, expect, it } from 'vitest';
import { LIMITE_PARTICIPANTES } from '../../config/limits';
import {
  MAX_CARACTERES_NOME_SUGERIDO,
  PARTICULAS_DO_NOME,
  ROTULOS_DE_CAMPO,
  ROTULOS_FALANTE_GENERICO,
  SUFIXOS_DE_CONVIDADO,
} from '../../config/falantes';
import { falantesDoTexto, lerVtt } from '../transcript/vtt';
import {
  descreverAdicaoDeFalantes,
  ehRotuloGenerico,
  listarNomes,
  padronizarCaixaDoNome,
  semSufixoDeConvidado,
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
      falantes: [nfd.normalize('NFC'), 'Helena Duarte', 'Íris Melo'],
      novos: [],
    });
  });

  it('o nome sugerido é o que será gravado: sem invisíveis e em NFC', () => {
    // Pela marca <v> (a regra "Nome: fala" do texto recusa o caractere invis\u00edvel).
    const { novos } = sugerirFalantes('', [], ['Joa\u0303o\u200b Prado']);
    expect(novos).toEqual(['João Prado']);
  });

  it('rótulos de campo do texto colado ("Assunto:", "Pauta:") não viram participantes', () => {
    const texto = [
      'Assunto: orçamento de 2027',
      'Data: 14/10',
      'Observação: sem quórum',
      'Tópico: obras',
      'Ana Souza: Bom dia.',
    ].join('\n');
    expect(sugerirFalantes(texto, []).falantes).toEqual(['Ana Souza']);
  });

  it('"Speaker 1: oi" no texto e <v Speaker 1> no .vtt não viram participantes', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      '<v Speaker 1>oi</v>',
      '',
      '00:00:03.000 --> 00:00:04.000',
      '<v Ana Souza>olá</v>',
    ].join('\n');
    const lido = lerVtt(vtt);
    expect(lido.falantesDasTags).toEqual(['Speaker 1', 'Ana Souza']);
    const texto = `${lido.texto}\nSpeaker 1: oi`;
    expect(sugerirFalantes(texto, [], lido.falantesDasTags).falantes).toEqual(['Ana Souza']);
  });

  describe('nomes das marcas <v> do .vtt (ex.: convidados de reunião online)', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      '<v Souza, Ana>Bom dia.',
      'Vamos começar.</v>',
      '',
      '00:00:03.000 --> 00:00:04.000',
      '<v Rui Matos (Convidado)>Olá.</v>',
      '',
      '00:00:05.000 --> 00:00:06.000',
      '<v Iva Reis (External)>Oi.</v>',
      '',
      '00:00:07.000 --> 00:00:08.000',
      '<v Bia Luz (Diretoria)>Oi.</v>',
      '',
      '00:00:09.000 --> 00:00:10.000',
      '<v Carla Dias>Tchau.</v>',
    ].join('\n');

    it('a regra "Nome: fala" do texto continua recusando esses nomes (não mudou)', () => {
      expect(falantesDoTexto(lerVtt(vtt).texto)).toEqual(['Carla Dias']);
    });

    it('são sugeridos como escritos, sem o sufixo de convidado e sem reordenar "Souza, Ana"', () => {
      const lido = lerVtt(vtt);
      expect(sugerirFalantes(lido.texto, [], lido.falantesDasTags).falantes).toEqual([
        'Souza, Ana',
        'Rui Matos',
        'Iva Reis',
        'Bia Luz (Diretoria)',
        'Carla Dias',
      ]);
    });

    it('o mesmo nome no texto e na marca conta uma vez; quem já está na lista não volta', () => {
      const lido = lerVtt(vtt);
      expect(
        sugerirFalantes(lido.texto, nomes('rui matos', 'Souza, Ana'), lido.falantesDasTags).novos,
      ).toEqual(['Iva Reis', 'Bia Luz (Diretoria)', 'Carla Dias']);
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
    expect(sugerirFalantes('Ana Souza: oi', [], ['Ana\u200b Souza']).falantes).toEqual([
      'Ana Souza',
    ]);
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

  it.each(ROTULOS_DE_CAMPO)('rótulo de campo "%s" não é pessoa', (rotulo) => {
    expect(ehRotuloGenerico(rotulo)).toBe(true);
    expect(ehRotuloGenerico(rotulo.toUpperCase())).toBe(true);
  });

  it.each([
    ['ROTULOS_FALANTE_GENERICO', ROTULOS_FALANTE_GENERICO],
    ['ROTULOS_DE_CAMPO', ROTULOS_DE_CAMPO],
    ['SUFIXOS_DE_CONVIDADO', SUFIXOS_DE_CONVIDADO],
  ])('%s em config está normalizada e sem repetição', (_nome, lista) => {
    expect(lista.length).toBeGreaterThan(0);
    for (const item of lista) expect(normalizarBusca(item)).toBe(item);
    expect(new Set(lista).size).toBe(lista.length);
  });

  it('acentuado no texto casa com a lista normalizada', () => {
    expect(ehRotuloGenerico('Observação')).toBe(true);
    expect(ehRotuloGenerico('Decisão')).toBe(true);
    expect(ehRotuloGenerico('Horário')).toBe(true);
  });

  it('acento e caixa não importam; nome de pessoa não é genérico', () => {
    expect(ehRotuloGenerico('Usuário 3')).toBe(true);
    expect(ehRotuloGenerico('Ana Souza')).toBe(false);
    expect(ehRotuloGenerico('Speaker Ana')).toBe(false);
    expect(ehRotuloGenerico('Pessoa Física')).toBe(false);
  });
});

describe('padronizarCaixaDoNome', () => {
  it.each([
    ['MARIA DE ALMEIDA PRADO', 'Maria de Almeida Prado'],
    ['maria de almeida prado', 'Maria de Almeida Prado'],
    ['JOÃO DA SILVA', 'João da Silva'],
    ['ÍRIS DOS SANTOS E SOUZA', 'Íris dos Santos e Souza'],
    ['MARIA DAS DORES DO VALE', 'Maria das Dores do Vale'],
  ])('todo maiúsculo ou minúsculo: "%s" → "%s"', (entrada, esperado) => {
    expect(padronizarCaixaDoNome(entrada)).toBe(esperado);
  });

  it('partícula na primeira palavra ganha maiúscula', () => {
    expect(padronizarCaixaDoNome('DE SOUZA')).toBe('De Souza');
    expect(padronizarCaixaDoNome('das neves')).toBe('Das Neves');
  });

  it("hífen e apóstrofo: cada parte com maiúscula; d' no meio fica minúsculo", () => {
    expect(padronizarCaixaDoNome('ana-maria')).toBe('Ana-Maria');
    expect(padronizarCaixaDoNome("D'AVILA")).toBe("D'Avila");
    expect(padronizarCaixaDoNome("PEDRO D'AVILA")).toBe("Pedro d'Avila");
    expect(padronizarCaixaDoNome('PEDRO D’AVILA')).toBe('Pedro d’Avila');
    expect(padronizarCaixaDoNome('ANA-MARIA DE OLIVEIRA-SOUZA')).toBe(
      'Ana-Maria de Oliveira-Souza',
    );
  });

  it('inicial com ponto continua com o ponto', () => {
    expect(padronizarCaixaDoNome('J. SOUZA')).toBe('J. Souza');
    expect(padronizarCaixaDoNome('MARIA J. SOUZA')).toBe('Maria J. Souza');
  });

  it('caixa mista fica como a pessoa escreveu', () => {
    for (const nome of ['Ana Souza', 'McDonald', 'DiCaprio', 'ana Souza', 'Souza, Ana']) {
      expect(padronizarCaixaDoNome(nome)).toBe(nome);
    }
  });

  it('PARTICULAS_DO_NOME em config está normalizada e sem repetição', () => {
    for (const p of PARTICULAS_DO_NOME) expect(normalizarBusca(p)).toBe(p);
    expect(new Set(PARTICULAS_DO_NOME).size).toBe(PARTICULAS_DO_NOME.length);
  });

  it('na sugestão: "MARIA SILVA" e "Maria Silva" viram uma pessoa só, com a caixa padrão', () => {
    expect(sugerirFalantes('MARIA SILVA: oi\nMaria Silva: de novo', []).falantes).toEqual([
      'Maria Silva',
    ]);
    expect(
      sugerirFalantes('', nomes('maria de almeida prado'), ['MARIA DE ALMEIDA PRADO', 'Ana Souza']),
    ).toEqual({ falantes: ['Maria de Almeida Prado', 'Ana Souza'], novos: ['Ana Souza'] });
  });
});

describe('nome de marca <v> comprido demais', () => {
  it(`acima de MAX_CARACTERES_NOME_SUGERIDO não é sugerido; no limite, é`, () => {
    const noLimite = `Ana ${'a'.repeat(MAX_CARACTERES_NOME_SUGERIDO - 4)}`;
    const acima = `Rui ${'r'.repeat(MAX_CARACTERES_NOME_SUGERIDO - 3)}`;
    expect(noLimite).toHaveLength(MAX_CARACTERES_NOME_SUGERIDO);
    expect(acima).toHaveLength(MAX_CARACTERES_NOME_SUGERIDO + 1);
    expect(sugerirFalantes('', [], [acima, noLimite, 'Iva Reis']).falantes).toEqual([
      noLimite,
      'Iva Reis',
    ]);
  });
});

describe('semSufixoDeConvidado', () => {
  it.each(SUFIXOS_DE_CONVIDADO)('tira "(%s)" do fim, com qualquer caixa', (sufixo) => {
    expect(semSufixoDeConvidado(`Ana Souza (${sufixo})`)).toBe('Ana Souza');
    expect(semSufixoDeConvidado(`Ana Souza (${sufixo.toUpperCase()}) `)).toBe('Ana Souza');
  });

  it('outro parêntese, ou no meio, fica como está', () => {
    expect(semSufixoDeConvidado('Ana Souza (TI)')).toBe('Ana Souza (TI)');
    expect(semSufixoDeConvidado('Ana (Convidada) Souza')).toBe('Ana (Convidada) Souza');
    expect(semSufixoDeConvidado('Souza, Ana')).toBe('Souza, Ana');
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
