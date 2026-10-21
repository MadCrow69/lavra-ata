import { useConsultaMidia } from '../ui/useConsultaMidia';

/** Largura mínima (px) para exibir Editar e Documento lado a lado. */
export const LARGURA_DUAS_COLUNAS = 1024;

const CONSULTA = `(min-width: ${String(LARGURA_DUAS_COLUNAS)}px)`;

/**
 * `true` quando a janela comporta duas colunas; reage a redimensionamento. Sem `matchMedia`
 * (ambientes antigos), assume tela larga: ambos os painéis visíveis.
 */
export function useLarguraLarga(): boolean {
  return useConsultaMidia(CONSULTA, true);
}
