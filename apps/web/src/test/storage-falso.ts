/** Storage em memória para testes, que pode recusar gravações (cota cheia) ou leituras (bloqueado). */
export function storageFalso(opcoes: { recusaGravar?: boolean; recusaLer?: boolean } = {}) {
  const itens = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return itens.size;
    },
    clear: () => {
      itens.clear();
    },
    getItem: (k) => {
      if (opcoes.recusaLer) throw new DOMException('bloqueado', 'SecurityError');
      return itens.get(k) ?? null;
    },
    key: (i) => [...itens.keys()][i] ?? null,
    removeItem: (k) => {
      itens.delete(k);
    },
    setItem: (k, v) => {
      if (opcoes.recusaGravar) throw new DOMException('cheio', 'QuotaExceededError');
      itens.set(k, v);
    },
  };
  return { storage, itens };
}
