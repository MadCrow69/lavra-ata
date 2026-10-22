import { resumoDoErro } from '../ai/errors';
import { ROTULO_CURTO } from '../config/models';
import type { Atribuicao, FalhaAnterior } from '../domain/draft';

/** "OpenAI falhou (limite de uso)"; sem motivo gravado (rascunho de versão anterior), "OpenAI falhou". */
export function textoDaFalha(f: FalhaAnterior): string {
  const nome = `${ROTULO_CURTO[f.provedor]} falhou`;
  return f.erro === undefined ? nome : `${nome} (${resumoDoErro(f.erro, f.motivo)})`;
}

/**
 * Linha de autoria de um trecho gerado (spec 8.1.1, nada de troca silenciosa):
 * "Gerado por Gemini · gemini-3.8-flash — OpenAI falhou (limite de uso)".
 */
export function textoDeGeracao(a: Atribuicao): string {
  const autoria = `Gerado por ${ROTULO_CURTO[a.provedor]} · ${a.modelo}`;
  return a.falhas.length === 0 ? autoria : `${autoria} — ${a.falhas.map(textoDaFalha).join('; ')}`;
}
