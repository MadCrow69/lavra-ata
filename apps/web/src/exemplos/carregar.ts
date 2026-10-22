import { obterTipo } from '../ata-types/registry';
import type { AtaDraft } from '../domain/draft';
import { normalizarResultado } from '../generation/normalize';
import type { Exemplo } from './tipos';

/**
 * Carga sob demanda dos exemplos: cada tipo de ata tem o seu módulo em `dados/`, que só chega por
 * `import()` (chunk `exemplo-<tipo>`), nunca na carga inicial — o `check-bundle` reprova o build se
 * o CPF fictício dos dados (`MARCADORES_EXEMPLO`) aparecer nela.
 */

export type CarregadoresExemplo = Record<string, () => Promise<Exemplo>>;

export const CARREGADORES_EXEMPLO: CarregadoresExemplo = {
  corporativa: () => import('./dados/exemplo-corporativa').then((m) => m.exemplo),
  cipa: () => import('./dados/exemplo-cipa').then((m) => m.exemplo),
  condominio: () => import('./dados/exemplo-condominio').then((m) => m.exemplo),
  'socios-ltda': () => import('./dados/exemplo-socios-ltda').then((m) => m.exemplo),
};

export const MENSAGEM_ERRO_EXEMPLO =
  'Não foi possível carregar o exemplo. Verifique a conexão e recarregue a página.';

/**
 * Falha ao carregar um exemplo. A mensagem é sempre `MENSAGEM_ERRO_EXEMPLO` e o erro original
 * (do import dinâmico, com caminho de chunk) nunca é guardado, exibido nem registrado.
 */
export class ErroExemplo extends Error {
  constructor() {
    super(MENSAGEM_ERRO_EXEMPLO);
    this.name = 'ErroExemplo';
  }
}

/**
 * Exemplo do tipo `tipoId`. Tipo sem carregador, carregador que falha ou que devolve o exemplo de
 * outro tipo → `ErroExemplo`. `Object.hasOwn`: um id como "constructor" não acha função herdada.
 */
export async function carregarExemplo(
  tipoId: string,
  carregadores: CarregadoresExemplo = CARREGADORES_EXEMPLO,
): Promise<Exemplo> {
  const carregar = Object.hasOwn(carregadores, tipoId) ? carregadores[tipoId] : undefined;
  if (carregar === undefined) throw new ErroExemplo();
  try {
    const exemplo = await carregar();
    if (exemplo.tipoId === tipoId) return exemplo;
  } catch {
    // O erro original não sai daqui (só a mensagem com causa e ação).
  }
  throw new ErroExemplo();
}

/**
 * Rascunho pronto do exemplo, como se a ata tivesse acabado de ser gerada: formato `versao: 1`,
 * tom formal, sem mapa de marcadores (nada foi mascarado nem enviado) e o resultado passado pela
 * mesma normalização da saída da IA. Tudo copiado: editar o rascunho não altera o exemplo.
 */
export function rascunhoDoExemplo(ex: Exemplo): AtaDraft {
  return {
    versao: 1,
    tipoId: ex.tipoId,
    tom: 'formal',
    dados: { ...ex.dados },
    pauta: [...ex.pauta],
    participantes: ex.participantes.map((p) => ({ ...p, extras: { ...p.extras } })),
    transcricao: ex.transcricao,
    mapa: null,
    resultado: {
      ...normalizarResultado(ex.saida, obterTipo(ex.tipoId)),
      atribuicao: {},
      avisos: {},
      editadas: [],
    },
  };
}
