import { describe, expect, it } from 'vitest';
import { nomeDoArquivo } from './nome-arquivo';

describe('nomeDoArquivo', () => {
  it('monta ata-<tipo>-<data>.<ext>', () => {
    expect(nomeDoArquivo('corporativa', '2026-10-14', 'pdf')).toBe(
      'ata-corporativa-2026-10-14.pdf',
    );
  });

  it('data vazia, inexistente ou hostil vira sem-data', () => {
    expect(nomeDoArquivo('corporativa', '', 'docx')).toBe('ata-corporativa-sem-data.docx');
    expect(nomeDoArquivo('corporativa', undefined, 'docx')).toBe('ata-corporativa-sem-data.docx');
    expect(nomeDoArquivo('corporativa', '2026-02-30', 'pdf')).toBe('ata-corporativa-sem-data.pdf');
    expect(nomeDoArquivo('corporativa', '../../etc', 'pdf')).toBe('ata-corporativa-sem-data.pdf');
  });

  it('usa a data aparada', () => {
    expect(nomeDoArquivo('corporativa', ' 2026-10-14 ', 'pdf')).toBe(
      'ata-corporativa-2026-10-14.pdf',
    );
  });

  it('tira acentos, minúsculas e separadores do tipo', () => {
    expect(nomeDoArquivo('Condomínio Ação/../x', '2026-10-14', 'pdf')).toBe(
      'ata-condominio-acao-x-2026-10-14.pdf',
    );
  });

  it('tipo vazio ou só símbolos é omitido', () => {
    expect(nomeDoArquivo('', '2026-10-14', 'pdf')).toBe('ata-2026-10-14.pdf');
    expect(nomeDoArquivo('***', undefined, 'docx')).toBe('ata-sem-data.docx');
  });

  it('limita o tipo a 40 caracteres sem hífen na ponta', () => {
    expect(nomeDoArquivo(`${'a'.repeat(39)} b`, '2026-10-14', 'pdf')).toBe(
      `ata-${'a'.repeat(39)}-2026-10-14.pdf`,
    );
    expect(nomeDoArquivo('a'.repeat(500), '2026-10-14', 'pdf')).toBe(
      `ata-${'a'.repeat(40)}-2026-10-14.pdf`,
    );
  });

  it('50 entradas hostis dão sempre nome ASCII curto e seguro', () => {
    const base = ['"', '<>:"/\\|?*', '😀', 'a'.repeat(500), '..', ' ', 'ç', '\u0000', '%2e%2e'];
    const entradas: string[] = [];
    for (let i = 0; i < 50; i += 1) {
      entradas.push(
        `${base[i % base.length] ?? ''}${base[(i * 3 + 1) % base.length] ?? ''}${String(i)}`,
      );
    }
    expect(entradas).toHaveLength(50);
    for (const tipo of entradas) {
      for (const data of [undefined, tipo, '2026-10-14']) {
        for (const formato of ['pdf', 'docx'] as const) {
          const nome = nomeDoArquivo(tipo, data, formato);
          expect(nome).toMatch(/^ata(-[a-z0-9]+)*\.(pdf|docx)$/);
          expect(nome.length).toBeLessThanOrEqual(80);
        }
      }
    }
  });
});
