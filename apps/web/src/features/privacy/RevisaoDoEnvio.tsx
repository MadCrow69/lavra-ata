import { useMemo } from 'react';
import { ROTULO_CURTO } from '../../config/models';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { AvisoColisoes, AvisoNomes, AvisoSensiveis } from './avisos';
import styles from './destaques.module.css';
import { fatiar, mesclarTrechos } from './fatiar';
import type { RevisaoDoEnvioProps } from './RevisaoSobDemanda';
import { ROTULO_CONTEUDO_ENVIADO, TITULO_REVISAO } from './revisao-textos';
import { detectarTermosSensiveis } from './termos-sensiveis';
import { classeDoTrecho, TextoDestacado } from './TextoDestacado';

/** "OpenAI · gpt-6-luna (se falhar, para Gemini, depois Anthropic)". */
function descreverDestino(cadeia: RevisaoDoEnvioProps['cadeia']): string {
  const [primeiro, ...depois] = cadeia;
  if (!primeiro) return '';
  const fila =
    depois.length === 0
      ? ''
      : ` (se falhar, para ${depois.map((c) => ROTULO_CURTO[c.id]).join(', depois ')})`;
  return `${ROTULO_CURTO[primeiro.id]} · ${primeiro.modelo}${fila}`;
}

const classeDoPedido = classeDoTrecho(styles.marca);

/**
 * Revisão antes de enviar à IA (ata inteira ou seção): o pedido inteiro como sai do navegador
 * (só os marcadores de dados reais destacados, termos de possível dado sensível com estilo
 * próprio), para quem vai, as instruções fixas e os avisos. Nada sai antes de "Enviar"; não há
 * como desligar esta etapa: ela é a autorização do envio. Carregada sob demanda
 * (`RevisaoSobDemanda`).
 */
export function RevisaoDoEnvio({
  previa,
  cadeia,
  descricao,
  motivo,
  avisoSubstituir,
  rotuloEnviar,
  onCancelar,
  onEnviar,
}: RevisaoDoEnvioProps) {
  const { usuario } = previa;
  const sensiveis = useMemo(() => detectarTermosSensiveis(usuario), [usuario]);
  const partes = useMemo(
    () => fatiar(usuario, mesclarTrechos(previa.marcadores, sensiveis)),
    [usuario, previa.marcadores, sensiveis],
  );

  return (
    <Modal
      aberto
      titulo={TITULO_REVISAO}
      onFechar={onCancelar}
      acoes={
        <>
          <Button onClick={onCancelar}>Cancelar</Button>
          <Button variante="primario" onClick={onEnviar}>
            {rotuloEnviar}
          </Button>
        </>
      }
    >
      <div className={styles.revisao}>
        {motivo === null ? null : (
          <p className={styles.motivoRevisao}>
            <span aria-hidden="true">↻ </span>
            {motivo}
          </p>
        )}
        <p className={styles.destinoEnvio}>
          {`${descricao} Isto sai do seu navegador para ${descreverDestino(cadeia)}.`}
        </p>
        <AvisoNomes>
          Os marcadores voltam aos valores originais só neste navegador, depois da resposta.
        </AvisoNomes>
        {avisoSubstituir === null ? null : <p className={styles.aviso}>{avisoSubstituir}</p>}
        <AvisoColisoes colisoes={previa.colisoes} />
        <AvisoSensiveis texto={usuario} achados={sensiveis} />
        <div
          className={styles.texto}
          role="region"
          aria-label={ROTULO_CONTEUDO_ENVIADO}
          tabIndex={0}
          data-testid="conteudo-enviado"
        >
          <TextoDestacado partes={partes} classeDe={classeDoPedido} />
        </div>
        <details className={styles.instrucoes}>
          <summary>
            Instruções do Lavra enviadas junto (iguais em toda ata deste tipo e tom, sem dados da
            reunião)
          </summary>
          <div className={styles.texto} data-testid="instrucoes-enviadas">
            {previa.sistema}
          </div>
        </details>
      </div>
    </Modal>
  );
}
