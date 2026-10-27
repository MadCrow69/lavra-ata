import { useEffect, useRef } from 'react';
import { obterTipo } from '../ata-types/registry';
import { useKeys } from '../ai/KeysContext';
import { useDraft } from '../domain/DraftContext';
import { destinoDe } from '../generation/autorizacao';
import { useOperacaoIA } from '../generation/OperacaoIA';
import { previaDoEnvio } from '../generation/pipeline';

/**
 * Simula a sessão em que a ata já foi revisada e enviada ("Enviar" na revisão): ao montar, o
 * conteúdo-base do rascunho inicial e a fila de então ficam autorizados, uma vez só. Serve aos
 * testes de seção que partem de uma ata pronta; os testes da própria revisão não o usam.
 */
export function AutorizacaoDaSessao() {
  const { state } = useDraft();
  const { autorizar } = useOperacaoIA();
  const keys = useKeys();
  const feitoRef = useRef(false);
  useEffect(() => {
    if (feitoRef.current) return;
    feitoRef.current = true;
    autorizar({
      base: previaDoEnvio(state, obterTipo(state.tipoId)).base,
      destinos: keys.cadeia().map(destinoDe),
    });
  }, [autorizar, keys, state]);
  return null;
}
