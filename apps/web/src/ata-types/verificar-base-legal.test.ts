import { describe, expect, it } from 'vitest';
import { TIPO_DE_TESTE } from '../test/tipo-de-teste';
import type { AtaTypeDefinition } from './types';
import { verificarBaseLegal } from './verificar-base-legal';

const CC = 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm';
const NR5 = 'https://www.gov.br/trabalho-e-emprego/nr-5.pdf';

/** Tipo falso: só `rotulo` e `textosFixos` importam para o verificador. */
const TIPO_FALSO: AtaTypeDefinition = {
  ...TIPO_DE_TESTE,
  id: 'falso',
  rotulo: 'Tipo falso',
  textosFixos: { a: 'x', b: 'y' },
};

/** Tipo sem textos fixos (como a corporativa): fica fora da verificação. */
const TIPO_SEM_TEXTOS: AtaTypeDefinition = { ...TIPO_DE_TESTE, id: 'livre', rotulo: 'Livre' };

const CABECALHO = [
  '| Chave | Trecho do template | Norma (artigo/item) | Link oficial | Consulta |',
  '| --- | --- | --- | --- | --- |',
];

function linha(chave: string, consulta = '21/10/2026', link = `[CC](${CC})`): string {
  return `| \`${chave}\` | Texto ${chave}. | CC, art. 1.075 | ${link} | ${consulta} |`;
}

function documento(linhas: string[], extra: string[] = []): string {
  return [
    '# Base legal dos modelos de ata',
    '',
    '## Fontes consultadas',
    '',
    `- [Código Civil](${CC}) — consulta em 21/10/2026.`,
    `- [NR-5](${NR5}) — consulta em 21/10/2026.`,
    '',
    '## Tipo falso',
    '',
    ...CABECALHO,
    ...linhas,
    '',
    ...extra,
  ].join('\n');
}

const CORRETO = documento([linha('a'), linha('b', '22/10/2026')]);

describe('verificarBaseLegal', () => {
  it('documento correto → sem problemas', () => {
    expect(verificarBaseLegal(CORRETO, [TIPO_FALSO, TIPO_SEM_TEXTOS])).toEqual([]);
  });

  it('a mesma chave pode ter mais de uma linha (mais de uma norma)', () => {
    const md = documento([linha('a'), linha('a', '21/10/2026', `[NR-5](${NR5})`), linha('b')]);
    expect(verificarBaseLegal(md, [TIPO_FALSO])).toEqual([]);
  });

  it('link http:// em qualquer lugar → problema', () => {
    const md = documento([linha('a'), linha('b')], ['Veja http://exemplo.com.']);
    const problemas = verificarBaseLegal(md, [TIPO_FALSO]);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('http://exemplo.com');
  });

  it('link https:// fora de www.planalto.gov.br e www.gov.br → problema', () => {
    const md = documento([linha('a'), linha('b', '21/10/2026', '[x](https://www.exemplo.com.br)')]);
    const problemas = verificarBaseLegal(md, [TIPO_FALSO]);
    expect(problemas.join('\n')).toContain('https://www.exemplo.com.br');
    // Subdomínio parecido também não vale.
    const parecido = documento([linha('a'), linha('b')], ['[x](https://www.gov.br.exemplo.com)']);
    expect(verificarBaseLegal(parecido, [TIPO_FALSO])).not.toEqual([]);
  });

  it('linha com célula vazia → problema', () => {
    const vazia = `| \`b\` |  | CC, art. 1.075 | [CC](${CC}) | 21/10/2026 |`;
    const problemas = verificarBaseLegal(documento([linha('a'), vazia]), [TIPO_FALSO]);
    expect(problemas.some((p) => p.includes('vazia'))).toBe(true);
  });

  it('linha com número de células diferente de 5 → problema', () => {
    const curta = `| \`b\` | Texto. | CC | 21/10/2026 |`;
    expect(verificarBaseLegal(documento([linha('a'), curta]), [TIPO_FALSO])).not.toEqual([]);
  });

  it('data fora de dd/mm/aaaa, inexistente ou anterior a 21/10/2026 → problema', () => {
    for (const data of ['2026-10-21', '31/02/2027', '20/10/2026']) {
      const problemas = verificarBaseLegal(documento([linha('a'), linha('b', data)]), [TIPO_FALSO]);
      expect(problemas.some((p) => p.includes(data))).toBe(true);
    }
  });

  it('chave sem crases → problema', () => {
    const semCrase = `| b | Texto. | CC, art. 1.075 | [CC](${CC}) | 21/10/2026 |`;
    const problemas = verificarBaseLegal(documento([linha('a'), semCrase]), [TIPO_FALSO]);
    expect(problemas.some((p) => p.includes('crases'))).toBe(true);
  });

  it('link oficial sem https:// na coluna → problema', () => {
    const problemas = verificarBaseLegal(documento([linha('a'), linha('b', '21/10/2026', 'CC')]), [
      TIPO_FALSO,
    ]);
    expect(problemas.some((p) => p.includes('Link oficial'))).toBe(true);
  });

  it('chave de textosFixos sem linha → problema citando a chave', () => {
    const problemas = verificarBaseLegal(documento([linha('a')]), [TIPO_FALSO]);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('“b”');
  });

  it('linha com chave inexistente → problema "órfã"', () => {
    const problemas = verificarBaseLegal(documento([linha('a'), linha('b'), linha('c')]), [
      TIPO_FALSO,
    ]);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('órfã');
    expect(problemas[0]).toContain('“c”');
  });

  it('tipo com textosFixos sem seção → problema citando o rótulo', () => {
    const outro: AtaTypeDefinition = { ...TIPO_FALSO, id: 'outro', rotulo: 'Outro tipo' };
    const problemas = verificarBaseLegal(CORRETO, [TIPO_FALSO, outro]);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('Outro tipo');
  });

  it('tabela de chaves numa seção que não é de nenhum tipo → problema (seção órfã)', () => {
    const md = documento(
      [linha('a'), linha('b')],
      ['## Tipo removido', '', ...CABECALHO, linha('z')],
    );
    const problemas = verificarBaseLegal(md, [TIPO_FALSO]);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('Tipo removido');
  });

  it('linhas de tabela fora de um cabeçalho "| Chave" não são lidas', () => {
    const md = documento(
      [linha('a'), linha('b')],
      ['| Outra | tabela |', '| --- | --- |', '| x | y |'],
    );
    expect(verificarBaseLegal(md, [TIPO_FALSO])).toEqual([]);
  });

  it('pipe escapado dentro da célula não quebra a linha', () => {
    const comPipe = `| \`b\` | Texto com \\| barra. | CC, art. 1.075 | [CC](${CC}) | 21/10/2026 |`;
    expect(verificarBaseLegal(documento([linha('a'), comPipe]), [TIPO_FALSO])).toEqual([]);
  });

  it('tipos sem textosFixos não exigem seção', () => {
    expect(verificarBaseLegal(documento([linha('a'), linha('b')]), [TIPO_SEM_TEXTOS])).toEqual([
      'Seção “Tipo falso” tem tabela de chaves, mas nenhum tipo com textosFixos tem esse rótulo (seção órfã).',
    ]);
  });
});
