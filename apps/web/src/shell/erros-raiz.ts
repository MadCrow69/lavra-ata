import type { RootOptions } from 'react-dom/client';

export const MENSAGEM_ERRO_RAIZ =
  'O Lavra encontrou um erro (detalhes omitidos para não expor dados da ata).';

/**
 * O React 19 registra no console o erro e a pilha de componentes (e a pilha pode incluir texto da
 * ata). Estes handlers trocam o relato padrão por uma mensagem fixa: nada do erro é repassado.
 */
function registrarSemDetalhes(): void {
  console.error(MENSAGEM_ERRO_RAIZ);
}

export const OPCOES_RAIZ: RootOptions = {
  onCaughtError: registrarSemDetalhes,
  onUncaughtError: registrarSemDetalhes,
  onRecoverableError: registrarSemDetalhes,
};
