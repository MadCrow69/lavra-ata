import { describe, expect, it } from 'vitest';
import { vttParaTexto } from './vtt';

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
