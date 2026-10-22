import { describe, expect, it } from 'vitest';
import {
  FALANTES_FICTICIOS,
  FIM_ULTIMO_CUE_MS,
  INICIO_PRIMEIRO_CUE_MS,
  vttFicticio,
} from '../../test/vtt-ficticio';
import { falantesDoTexto, lerVtt, vttParaTexto } from './vtt';

describe('vttParaTexto', () => {
  it('converte cues com <v Nome> e timestamps em "Nome: fala"', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:04.000',
      '<v Maria Souza>Bom dia a todos.</v>',
      '',
      '00:00:05.000 --> 00:00:08.000',
      '<v João Pereira>Bom dia, Maria.</v>',
      '',
    ].join('\n');
    expect(vttParaTexto(vtt)).toBe('Maria Souza: Bom dia a todos.\nJoão Pereira: Bom dia, Maria.');
  });

  it('une falas consecutivas do mesmo falante', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:03.000',
      '<v Maria Souza>Primeiro ponto.</v>',
      '',
      '00:00:03.500 --> 00:00:06.000',
      '<v Maria Souza>Segundo ponto.</v>',
      '',
      '00:00:07.000 --> 00:00:09.000',
      '<v João Pereira>Concordo.</v>',
      '',
      '00:00:10.000 --> 00:00:12.000',
      '<v Maria Souza>Voltando.</v>',
    ].join('\n');
    expect(vttParaTexto(vtt)).toBe(
      'Maria Souza: Primeiro ponto. Segundo ponto.\nJoão Pereira: Concordo.\nMaria Souza: Voltando.',
    );
  });

  it('aceita CRLF, identificadores de cue, NOTE e cabeçalho com metadados', () => {
    const vtt = [
      'WEBVTT - reunião de outubro',
      '',
      'NOTE gerado automaticamente',
      '',
      'cue-1',
      '00:00:01.000 --> 00:00:03.000 align:start',
      '<v Ana Lima>Vamos começar.</v>',
      '',
      'cue-2',
      '00:00:04.000 --> 00:00:06.000',
      '<v Ana Lima>Pauta de hoje.</v>',
      '',
    ].join('\r\n');
    expect(vttParaTexto(vtt)).toBe('Ana Lima: Vamos começar. Pauta de hoje.');
  });

  it('aceita o formato "Nome: texto" e o une ao falante repetido', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:03.000',
      'Carlos Mota: Abrimos a sessão.',
      '',
      '00:00:03.000 --> 00:00:05.000',
      'Carlos Mota: Passo a palavra.',
      '',
      '00:00:05.000 --> 00:00:07.000',
      'Dora Reis: Obrigada.',
    ].join('\n');
    expect(vttParaTexto(vtt)).toBe(
      'Carlos Mota: Abrimos a sessão. Passo a palavra.\nDora Reis: Obrigada.',
    );
  });

  it('cue com várias linhas mantém o falante nas linhas seguintes', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:03.000',
      '<v Ana Lima>Primeira linha',
      'segunda linha.</v>',
    ].join('\n');
    expect(vttParaTexto(vtt)).toBe('Ana Lima: Primeira linha segunda linha.');
  });

  it('vtt sem falante devolve só o texto, sem timestamps', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:03.000',
      'Vamos começar a reunião.',
      '',
      '00:00:03.000 --> 00:00:05.000',
      'O primeiro item é o orçamento.',
    ].join('\n');
    const saida = vttParaTexto(vtt);
    expect(saida).toBe('Vamos começar a reunião. O primeiro item é o orçamento.');
    expect(saida).not.toContain('-->');
  });

  it('remove outras marcações e decodifica entidades', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:03.000',
      '<v Ana Lima><c.destaque>Lucro &amp; perda</c> <00:00:02.000>do <i>mês</i>.</v>',
    ].join('\n');
    expect(vttParaTexto(vtt)).toBe('Ana Lima: Lucro & perda do mês.');
  });

  it('não confunde frase com dois-pontos no meio com falante', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:03.000',
      'A decisão foi a seguinte e ficou registrada em ata: aprovado por todos.',
    ].join('\n');
    expect(vttParaTexto(vtt)).toBe(
      'A decisão foi a seguinte e ficou registrada em ata: aprovado por todos.',
    );
  });

  it('entrada vazia ou só com cabeçalho devolve texto vazio', () => {
    expect(vttParaTexto('')).toBe('');
    expect(vttParaTexto('WEBVTT\n\n')).toBe('');
  });

  it('"Nome:" só vale na primeira linha do cue; nas seguintes continua sendo fala', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:03.000',
      'Ana Lima: Vamos votar.',
      'Resumo da pauta: aprovada.',
    ].join('\n');
    expect(vttParaTexto(vtt)).toBe('Ana Lima: Vamos votar. Resumo da pauta: aprovada.');
  });

  it('tag <v.> malformada gigante é processada em tempo linear, sem lançar', () => {
    const vtt = ['WEBVTT', '', '00:00:01.000 --> 00:00:03.000', '<v.' + '!.'.repeat(50_000)].join(
      '\n',
    );
    const inicio = performance.now();
    expect(() => vttParaTexto(vtt)).not.toThrow();
    expect(performance.now() - inicio).toBeLessThan(200);
  });

  it('tags aninhadas não reconstroem uma tag após a limpeza', () => {
    const vtt = ['WEBVTT', '', '00:00:01.000 --> 00:00:03.000', '<scr<b>ipt>x'].join('\n');
    const saida = vttParaTexto(vtt);
    expect(saida).not.toContain('<script');
    expect(saida).toBe('x');
  });

  it('muitos "<" sem fechamento não degradam e o "<" literal é preservado', () => {
    const vtt = ['WEBVTT', '', '00:00:01.000 --> 00:00:03.000', '<'.repeat(50_000)].join('\n');
    const inicio = performance.now();
    expect(vttParaTexto(vtt)).toBe('<'.repeat(50_000));
    expect(performance.now() - inicio).toBeLessThan(200);
  });

  it('entidades &lt; e &gt; viram caracteres literais (texto puro)', () => {
    const vtt = ['WEBVTT', '', '00:00:01.000 --> 00:00:03.000', 'a &lt; b e c &gt; d'].join('\n');
    expect(vttParaTexto(vtt)).toBe('a < b e c > d');
  });

  it('aceita <v.classe Nome> e <v.a.b Nome>', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:03.000',
      '<v.loud Ana Lima>Oi.</v>',
      '',
      '00:00:04.000 --> 00:00:06.000',
      '<v.a.b João Pereira>Olá.</v>',
    ].join('\n');
    expect(vttParaTexto(vtt)).toBe('Ana Lima: Oi.\nJoão Pereira: Olá.');
  });
});

describe('lerVtt: duração', () => {
  const cue = (inicio: string, fim: string, fala: string) => [`${inicio} --> ${fim}`, fala, ''];

  it('duração = fim do último cue − início do primeiro, em ms (tempos relativos, sem data)', () => {
    const vtt = [
      'WEBVTT',
      '',
      ...cue('00:00:05.000', '00:00:09.000', '<v Ana Lima>Bom dia.'),
      ...cue('01:12:00.000', '01:12:35.500', '<v Rui Matos>Encerrando.'),
    ].join('\n');
    const lido = lerVtt(vtt);
    expect(lido.texto).toBe(vttParaTexto(vtt));
    expect(lido.duracaoMs).toBe((72 * 60 + 35.5 - 5) * 1000);
  });

  it('aceita horas omitidas e vírgula nos milissegundos', () => {
    const vtt = ['WEBVTT', '', ...cue('00:01,000', '45:01,250', 'Fala.')].join('\n');
    expect(lerVtt(vtt).duracaoMs).toBe(45 * 60 * 1000 + 250);
  });

  it('cue fora de ordem não encurta a duração: vale o menor início e o maior fim', () => {
    const vtt = [
      'WEBVTT',
      '',
      ...cue('00:10:00.000', '00:30:00.000', 'A.'),
      ...cue('00:00:00.000', '00:05:00.000', 'B.'),
    ].join('\n');
    expect(lerVtt(vtt).duracaoMs).toBe(30 * 60 * 1000);
  });

  it('sem cue com tempo, a duração é null', () => {
    expect(lerVtt('').duracaoMs).toBeNull();
    expect(lerVtt('WEBVTT\n\nNOTE só uma nota\n').duracaoMs).toBeNull();
  });
});

describe('falantesDoTexto', () => {
  it('lê "Nome: fala" de cada linha, na ordem, com repetições (a deduplicação é de quem usa)', () => {
    const texto = [
      'Ana Lima: Bom dia.',
      'Rui Matos: Olá.',
      'texto sem falante',
      '  ana lima: De novo.',
    ].join('\n');
    expect(falantesDoTexto(texto)).toEqual(['Ana Lima', 'Rui Matos', 'ana lima']);
  });

  it('usa a mesma regra do .vtt: o texto convertido devolve os nomes das tags <v>', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      '<v Ana Lima>Oi.</v>',
      '',
      '00:00:03.000 --> 00:00:04.000',
      'Rui Matos: Olá.',
    ].join('\n');
    expect(falantesDoTexto(vttParaTexto(vtt))).toEqual(['Ana Lima', 'Rui Matos']);
  });

  it('frase com dois-pontos, nome com mais de 5 palavras e linha vazia não são falantes', () => {
    const texto = [
      'A decisão foi a seguinte e ficou registrada em ata: aprovado.',
      'Um Dois Três Quatro Cinco Seis: fala.',
      '',
      'Sem dois pontos',
    ].join('\n');
    expect(falantesDoTexto(texto)).toEqual([]);
  });

  it('aceita CRLF', () => {
    expect(falantesDoTexto('Ana Lima: a\r\nRui Matos: b')).toEqual(['Ana Lima', 'Rui Matos']);
  });
});

describe('.vtt no formato exportado por ferramentas de reunião (fixture fictício)', () => {
  const vtt = vttFicticio(36);

  it('ids uuid/N-M e linhas de continuação: cada fala fica inteira, com o seu falante', () => {
    const linhas = lerVtt(vtt).texto.split('\n');
    expect(linhas).toHaveLength(36);
    expect(linhas[0]).toBe('Ana Souza: Bom dia a todos, vamos começar pela revisão do cronograma.');
    expect(linhas[1]).toBe(
      'Bruno Lima: Bom dia. O fornecedor confirmou a entrega para a próxima semana.',
    );
    expect(lerVtt(vtt).texto).not.toMatch(/0f3c2a9e|-->|<\/?v/);
  });

  it('a duração é o fim do último cue menos o início do primeiro (≈ 27 min), sem data nem hora', () => {
    expect(lerVtt(vtt).duracaoMs).toBe(FIM_ULTIMO_CUE_MS - INICIO_PRIMEIRO_CUE_MS);
  });

  it('cada falante aparece em toda volta do rodízio, e os quatro distintos são os do fixture', () => {
    const falantes = falantesDoTexto(lerVtt(vtt).texto);
    expect(falantes).toHaveLength(36);
    expect([...new Set(falantes)]).toEqual([...FALANTES_FICTICIOS]);
  });
});
