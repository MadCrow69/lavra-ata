import type { Bloco } from '../domain/draft';

/**
 * Inverso de `blocosParaTexto` (prompt.ts): lê o texto da edição manual e devolve os blocos.
 * Parágrafos são separados por linha em branco; linhas começando com "- " são itens de lista; o
 * texto logo acima dos itens, sem linha em branco, é o texto da lista. Uma linha que não começa
 * com "- " depois de um item continua esse item (quebra de linha na digitação).
 */
export function textoParaBlocos(texto: string): Bloco[] {
  return texto
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((trecho) => trecho.trim())
    .filter((trecho) => trecho !== '')
    .flatMap((trecho): Bloco[] => {
      const linhas = trecho.split('\n').map((l) => l.trim());
      const primeiroItem = linhas.findIndex((l) => l === '-' || l.startsWith('- '));
      if (primeiroItem === -1) return [{ tipo: 'paragrafo', texto: linhas.join('\n'), itens: [] }];

      const itens: string[] = [];
      for (const linha of linhas.slice(primeiroItem)) {
        if (linha === '-' || linha.startsWith('- ')) itens.push(linha.slice(1).trim());
        else if (itens.length > 0) itens[itens.length - 1] = `${itens.at(-1) ?? ''} ${linha}`;
      }
      const lista = itens.filter((i) => i !== '');
      const abertura = linhas.slice(0, primeiroItem).join('\n');
      if (lista.length === 0) {
        return abertura === '' ? [] : [{ tipo: 'paragrafo', texto: abertura, itens: [] }];
      }
      return [{ tipo: 'lista', texto: abertura, itens: lista }];
    });
}
