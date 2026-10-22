import { vi } from 'vitest';

/** Junta espaços e quebras: o texto extraído do PDF quebra a linha onde o layout quebrou. */
export const espacos = (texto: string): string => texto.replace(/\s+/g, ' ');

/**
 * Único aviso aceito: no Node, o pdfmake avisa que não há política de acesso a arquivos locais (no
 * navegador o aviso não existe: ver `isServer` em pdfmake/src/base.js).
 */
export const AVISO_ACESSO_LOCAL = 'No local access policy defined.';

/**
 * Espiona `console.warn` (chamar no `beforeAll`): o aviso do pdfmake no Node é engolido e qualquer
 * outro vai para `inesperados`, que o teste "nenhum aviso inesperado" confere vazio. Restaurar com
 * `vi.restoreAllMocks()`.
 */
export function vigiarAvisos(inesperados: unknown[][]): void {
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith(AVISO_ACESSO_LOCAL)) return;
    inesperados.push(args);
  });
}
