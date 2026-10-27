import { findMarkers } from '@lavra/pii-br';
import { useMemo } from 'react';
import type { ProviderConfig } from '../../ai/types';
import { ROTULO_CURTO } from '../../config/models';
import type { PreviaDoEnvio } from '../../generation/pipeline';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { AvisoColisoes, AvisoNomes, AvisoSensiveis } from './avisos';
import { fatiar, mesclarTrechos } from './fatiar';
import styles from './privacy.module.css';
import { detectarTermosSensiveis, ehTermoSensivel } from './termos-sensiveis';
import { TextoDestacado } from './TextoDestacado';

export const TITULO_REVISAO = 'Revise o que vai para a IA';
export const ROTULO_CONTEUDO_ENVIADO = 'Conteúdo enviado à IA';
export const AVISO_SUBSTITUIR =
  'Gerar de novo substitui a ata atual, inclusive as seções editadas à mão. Para mudar só uma parte, use as ações da própria seção na folha.';

export interface RevisaoDoEnvioProps {
  aberto: boolean;
  /** O pedido exato (`previaDoEnvio`): o que aparece aqui é o que sai ao enviar. */
  previa: PreviaDoEnvio | null;
  /** Fila de provedores, na ordem em que serão tentados. */
  cadeia: readonly ProviderConfig[];
  /** Já há ata: enviar a substitui (o aviso e o rótulo do botão mudam). */
  substitui: boolean;
  onCancelar: () => void;
  onEnviar: () => void;
}

/** "OpenAI · gpt-6-luna (se falhar, para Gemini, depois Anthropic)". */
function descreverDestino(cadeia: readonly ProviderConfig[]): string {
  const [primeiro, ...depois] = cadeia;
  if (!primeiro) return '';
  const fila =
    depois.length === 0
      ? ''
      : ` (se falhar, para ${depois.map((c) => ROTULO_CURTO[c.id]).join(', depois ')})`;
  return `${ROTULO_CURTO[primeiro.id]} · ${primeiro.modelo}${fila}`;
}

const classeDoTrecho = (t: object): string =>
  ehTermoSensivel(t) ? (styles.marcaSensivel ?? '') : (styles.marca ?? '');

/**
 * Revisão obrigatória antes de gerar a ata: mostra o pedido inteiro como sai do navegador
 * (marcadores destacados, termos de possível dado sensível com contorno próprio), para quem vai,
 * as instruções fixas e, se já houver ata, o aviso de que ela será substituída. Nada sai antes de
 * "Enviar". Não há como pular esta etapa: ela é a autorização do envio.
 */
export function RevisaoDoEnvio({
  aberto,
  previa,
  cadeia,
  substitui,
  onCancelar,
  onEnviar,
}: RevisaoDoEnvioProps) {
  const usuario = previa?.usuario ?? '';
  const sensiveis = useMemo(() => detectarTermosSensiveis(usuario), [usuario]);
  const partes = useMemo(
    () => fatiar(usuario, mesclarTrechos(findMarkers(usuario), sensiveis)),
    [usuario, sensiveis],
  );

  return (
    <Modal
      aberto={aberto && previa !== null}
      titulo={TITULO_REVISAO}
      onFechar={onCancelar}
      acoes={
        <>
          <Button onClick={onCancelar}>Cancelar</Button>
          <Button variante="primario" onClick={onEnviar}>
            {substitui ? 'Enviar e substituir a ata' : 'Enviar para a IA'}
          </Button>
        </>
      }
    >
      <div className={styles.revisao}>
        <p className={styles.destinoEnvio}>
          {`Isto sai do seu navegador para ${descreverDestino(cadeia)}.`}
        </p>
        <AvisoNomes>
          Os marcadores voltam aos valores originais só neste navegador, depois da resposta.
        </AvisoNomes>
        {substitui ? <p className={styles.aviso}>{AVISO_SUBSTITUIR}</p> : null}
        <AvisoColisoes colisoes={previa?.colisoes ?? []} />
        <AvisoSensiveis texto={usuario} achados={sensiveis} />
        <div
          className={styles.texto}
          role="region"
          aria-label={ROTULO_CONTEUDO_ENVIADO}
          tabIndex={0}
          data-testid="conteudo-enviado"
        >
          <TextoDestacado partes={partes} classeDe={classeDoTrecho} />
        </div>
        <details className={styles.instrucoes}>
          <summary>
            Instruções do Lavra enviadas junto (iguais em toda ata deste tipo e tom, sem dados da
            reunião)
          </summary>
          <div className={styles.texto} data-testid="instrucoes-enviadas">
            {previa?.sistema ?? ''}
          </div>
        </details>
      </div>
    </Modal>
  );
}
