import { useRef, useState } from 'react';
import { CAMPO_FIM, CAMPO_INICIO } from '../../ata-types/campos-comuns';
import { ehVisivel } from '../../ata-types/registry';
import type { AtaTypeDefinition } from '../../ata-types/types';
import { formatarHora } from '../../domain/dates';
import { useDraft } from '../../domain/DraftContext';
import { Button } from '../../ui/Button';
import { sugerirFim, textoDaSugestaoDoFim } from './fim-pela-duracao';
import styles from './sugestao.module.css';

interface Preenchido {
  /** Valor que o botão gravou no término (`HH:MM`). */
  fim: string;
  texto: string;
}

/**
 * Bloco 2: o término sugerido pela duração do .vtt. Só sugere com o término vazio, nunca o
 * sobrescreve; depois do clique, diz o que mudou e oferece "Desfazer".
 */
export function SugestaoDoFim({
  tipo,
  className,
}: {
  tipo: AtaTypeDefinition;
  /** Classe extra do contêiner (ex.: ocupar a linha inteira da grade do bloco). */
  className?: string | undefined;
}) {
  const { state, dispatch } = useDraft();
  const [preenchido, setPreenchido] = useState<Preenchido | null>(null);
  const textoRef = useRef<HTMLParagraphElement>(null);

  const temCampo = (id: string) =>
    tipo.campos.some((c) => c.id === id && ehVisivel(c, state.dados));
  const fim = state.dados[CAMPO_FIM.id] ?? '';

  // A pessoa mudou o término depois do clique: o aviso do preenchimento já não vale.
  if (preenchido !== null && preenchido.fim !== fim) setPreenchido(null);

  if (!temCampo(CAMPO_INICIO.id) || !temCampo(CAMPO_FIM.id)) return null;
  const valido = preenchido !== null && preenchido.fim === fim ? preenchido : null;
  const sugestao = sugerirFim(state.vtt?.duracaoMin ?? null, state.dados[CAMPO_INICIO.id], fim);
  if (valido === null && sugestao === null) return null;

  const preencher = (novo: string, texto: string) => {
    dispatch({ type: 'definirCampo', campo: CAMPO_FIM.id, valor: novo });
    setPreenchido({ fim: novo, texto });
    textoRef.current?.focus();
  };

  const desfazer = () => {
    dispatch({ type: 'definirCampo', campo: CAMPO_FIM.id, valor: '' });
    setPreenchido(null);
    textoRef.current?.focus();
  };

  return (
    <div className={`${styles.sugestao ?? ''} ${className ?? ''}`} data-testid="sugestao-fim">
      {/* Sem aria-live: o clique leva o foco a este texto, que é lido uma vez só. */}
      <p ref={textoRef} tabIndex={-1} className={styles.texto}>
        {valido?.texto ?? (sugestao ? textoDaSugestaoDoFim(sugestao) : '')}
      </p>
      {valido !== null ? <Button onClick={desfazer}>Desfazer</Button> : null}
      {valido === null && sugestao?.tipo === 'preencher' ? (
        <Button
          onClick={() => {
            const fimLegivel = formatarHora(sugestao.fim);
            preencher(
              sugestao.fim,
              `Término preenchido com ${fimLegivel} (início ${sugestao.inicio} + ${sugestao.duracao} da transcrição). Ajuste se a reunião terminou em outro horário.`,
            );
          }}
        >
          {`Preencher o término com ${formatarHora(sugestao.fim)}`}
        </Button>
      ) : null}
    </div>
  );
}
