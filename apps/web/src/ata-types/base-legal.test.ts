import { describe, expect, it } from 'vitest';
import md from '../../../../docs/base-legal.md?raw';
import { TIPO_DE_TESTE } from '../test/tipo-de-teste';
import { cipa } from './cipa';
import { condominio } from './condominio';
import { ATA_TYPES } from './registry';
import { sociosLtda } from './socios-ltda';
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
    expect(verificarBaseLegal(md, [...Object.values(ATA_TYPES), semSecao])).toEqual([
      `Falta a seção “## ${TIPO_DE_TESTE.rotulo}” para os textos fixos do tipo ${TIPO_DE_TESTE.id}.`,
    ]);
  });

  it('a guarda morde no registro real: sem as linhas de um texto fixo da CIPA, reprova', () => {
    const linhas = md.split(/\r?\n/);
    const daChave = (l: string) => /^\|\s*`nomeComissao`\s*\|/.test(l);
    // Piso: a chave tem linhas no arquivo (uma por norma) — todas saem.
    expect(linhas.filter(daChave).length).toBeGreaterThanOrEqual(1);
    const semLinha = linhas.filter((l) => !daChave(l)).join('\n');
    expect(verificarBaseLegal(semLinha, Object.values(ATA_TYPES))).toEqual([
      `${cipa.rotulo}: o texto fixo “nomeComissao” não tem linha com a norma.`,
    ]);
  });

  it('a guarda morde no registro real: sem as linhas de um texto fixo do condomínio, reprova', () => {
    const linhas = md.split(/\r?\n/);
    const daChave = (l: string) => /^\|\s*`meioEletronico`\s*\|/.test(l);
    expect(linhas.filter(daChave).length).toBeGreaterThanOrEqual(1);
    const semLinha = linhas.filter((l) => !daChave(l)).join('\n');
    expect(verificarBaseLegal(semLinha, Object.values(ATA_TYPES))).toEqual([
      `${condominio.rotulo}: o texto fixo “meioEletronico” não tem linha com a norma.`,
    ]);
  });

  it('a guarda morde no registro real: sem as linhas de um texto fixo da Ltda, reprova', () => {
    const linhas = md.split(/\r?\n/);
    const daChave = (l: string) => /^\|\s*`capitalPresente`\s*\|/.test(l);
    expect(linhas.filter(daChave).length).toBeGreaterThanOrEqual(1);
    const semLinha = linhas.filter((l) => !daChave(l)).join('\n');
    expect(verificarBaseLegal(semLinha, Object.values(ATA_TYPES))).toEqual([
      `${sociosLtda.rotulo}: o texto fixo “capitalPresente” não tem linha com a norma.`,
    ]);
  });

  it('a guarda morde no registro real: um texto fixo novo sem linha reprova', () => {
    const comNovo = { ...cipa, textosFixos: { ...cipa.textosFixos, inventado: 'x' } };
    // Os demais tipos registrados entram: sem eles, as seções deles seriam apontadas como órfãs.
    const tipos = Object.values(ATA_TYPES).map((t) => (t.id === cipa.id ? comNovo : t));
    expect(verificarBaseLegal(md, tipos)).toEqual([
      `${cipa.rotulo}: o texto fixo “inventado” não tem linha com a norma.`,
    ]);
  });
});
