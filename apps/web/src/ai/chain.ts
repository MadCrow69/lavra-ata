import { ESPERA_RETRY_MS, ROTULO_PROVEDOR } from '../config/models';
import { ErroCadeia, ErroProvedor, erroProvedor } from './errors';
import { ADAPTADORES } from './providers';
import type {
  FalhaProvedor,
  GenerateRequest,
  ProviderAdapter,
  ProviderConfig,
  ProviderId,
  ResultadoCadeia,
} from './types';

export interface OpcoesCadeia {
  /** Substitui os adaptadores reais (testes). */
  adaptadores?: Record<ProviderId, ProviderAdapter>;
  /** Espera antes do retry único, em ms. */
  esperaRetryMs?: number;
}

/** Espera `ms`, mas acorda com `cancelado` se o sinal abortar (e limpa o timer). */
function esperar(ms: number, signal: AbortSignal, provedor: ProviderId): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(erroProvedor('cancelado', provedor));
      return;
    }
    const aoAbortar = (): void => {
      clearTimeout(timer);
      reject(erroProvedor('cancelado', provedor));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', aoAbortar);
      resolve();
    }, ms);
    signal.addEventListener('abort', aoAbortar, { once: true });
  });
}

/** Qualquer erro vira ErroProvedor; erro inesperado nunca repassa o texto original (pode ter dados). */
function comoErroProvedor(e: unknown, provedor: ProviderId): ErroProvedor {
  return e instanceof ErroProvedor ? e : erroProvedor('instavel', provedor);
}

function mensagemDaCadeia(falhas: FalhaProvedor[]): string {
  if (falhas.length === 0) {
    return 'Nenhum provedor de IA está configurado. Informe ao menos uma chave nas configurações.';
  }
  const detalhes = falhas.map((f) => `${ROTULO_PROVEDOR[f.provedor]}: ${f.mensagem}`).join(' ');
  return `Nenhum provedor conseguiu gerar a ata. ${detalhes}`;
}

/**
 * Tenta os provedores em ordem. Avança em qualquer erro, exceto `cancelado` (relançado na hora).
 * `limite` e `instavel` ganham UMA nova tentativa após 2 s (cancelável) antes de avançar.
 * Se todos falharem, lança `ErroCadeia` com as falhas em ordem.
 */
export async function gerarComFallback(
  cadeia: ProviderConfig[],
  req: GenerateRequest,
  opcoes: OpcoesCadeia = {},
): Promise<ResultadoCadeia<unknown>> {
  const adaptadores = opcoes.adaptadores ?? ADAPTADORES;
  const espera = opcoes.esperaRetryMs ?? ESPERA_RETRY_MS;
  const falhas: FalhaProvedor[] = [];

  for (const cfg of cadeia) {
    const adaptador = adaptadores[cfg.id];
    let tentativa = 0;
    for (;;) {
      if (req.signal.aborted) throw erroProvedor('cancelado', cfg.id);
      try {
        const valor = await adaptador.gerar(cfg, req);
        return { valor, provedor: cfg.id, modelo: cfg.modelo, falhas };
      } catch (e) {
        const erro = comoErroProvedor(e, cfg.id);
        if (erro.tipo === 'cancelado') throw erro;
        const repetivel = erro.tipo === 'limite' || erro.tipo === 'instavel';
        if (repetivel && tentativa === 0) {
          tentativa++;
          await esperar(espera, req.signal, cfg.id);
          continue;
        }
        falhas.push({ provedor: cfg.id, erro: erro.tipo, mensagem: erro.message });
        break;
      }
    }
  }
  throw new ErroCadeia(falhas, mensagemDaCadeia(falhas));
}
