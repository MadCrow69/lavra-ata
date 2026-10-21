import { describe, expect, it } from 'vitest';
import md from '../../../../docs/base-legal.md?raw';
import { TIPO_DE_TESTE } from '../test/tipo-de-teste';
import { ATA_TYPES } from './registry';
import { verificarBaseLegal } from './verificar-base-legal';

describe('docs/base-legal.md', () => {
  it('não está vazio (piso: tem seções e o link do Código Civil)', () => {
    expect(md).toContain('## ');
    expect(md).toContain('https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm');
    expect(md).toContain('# Base legal dos modelos de ata');
  });

  it('liga cada texto fixo dos tipos registrados a uma norma com link oficial', () => {
    expect(verificarBaseLegal(md, Object.values(ATA_TYPES))).toEqual([]);
  });

  it('a guarda morde no arquivo real: um tipo formal sem seção é apontado', () => {
    const semSecao = { ...TIPO_DE_TESTE, textosFixos: { abertura: 'x' } };
    expect(verificarBaseLegal(md, [semSecao])).toEqual([
      `Falta a seção “## ${TIPO_DE_TESTE.rotulo}” para os textos fixos do tipo ${TIPO_DE_TESTE.id}.`,
    ]);
  });
});
