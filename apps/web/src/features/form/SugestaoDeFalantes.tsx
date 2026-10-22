import { useMemo, useRef } from 'react';
import type { AtaTypeDefinition } from '../../ata-types/types';
import { MAX_NOMES_NA_SUGESTAO } from '../../config/falantes';
import { LIMITE_PARTICIPANTES } from '../../config/limits';
import { useDraft } from '../../domain/DraftContext';
import { calcularAdicao } from '../../domain/participantes';
import { Button } from '../../ui/Button';
import { plural } from '../../ui/plural';
import { useToast } from '../../ui/Toast';
import {
  descreverAdicaoDeFalantes,
  listarNomes,
  pessoasQueFalaram,
  sugerirFalantes,
} from './falantes-da-transcricao';
import { NUMERO_BLOCO } from './numero-bloco';
import styles from './sugestao.module.css';

/**
 * Bloco 4: quem falou na transcrição e ainda não está no bloco 3. Nada entra sozinho: a pessoa
 * clica para adicionar (como presentes, papel vazio, no fim da lista) e ajusta depois.
 */
export function SugestaoDeFalantes({ tipo }: { tipo: AtaTypeDefinition }) {
  const { state, dispatch } = useDraft();
  const { mostrar } = useToast();
  const textoRef = useRef<HTMLParagraphElement>(null);
  const { transcricao, participantes, vtt } = state;
  const sugestao = useMemo(
    () => sugerirFalantes(transcricao, participantes, vtt?.falantes),
    [transcricao, participantes, vtt],
  );
  const { falantes, novos } = sugestao;
  if (falantes.length === 0) return null;

  const pessoa = tipo.rotulos.pessoa;
  const jaNaLista = falantes.length - novos.length;
  const semVaga = calcularAdicao(participantes.length, novos.length).adicionados === 0;

  const adicionar = () => {
    const { adicionados, ignorados } = calcularAdicao(participantes.length, novos.length);
    dispatch({ type: 'adicionarParticipantes', nomes: novos });
    mostrar({ titulo: descreverAdicaoDeFalantes({ adicionados, jaNaLista, ignorados }, pessoa) });
    // O botão pode sair de cena: o foco fica no texto, que passa a dizer o que restou.
    textoRef.current?.focus();
  };

  const principal =
    novos.length === 0
      ? 'Todos os que falaram já estão na lista.'
      : [
          `Encontramos ${pessoasQueFalaram(falantes.length)}: ${listarNomes(falantes, MAX_NOMES_NA_SUGESTAO)}.`,
          jaNaLista > 0
            ? `${String(jaNaLista)} ${plural(jaNaLista, 'já está', 'já estão')} na lista.`
            : '',
        ]
          .filter(Boolean)
          .join(' ');

  return (
    <div className={styles.sugestao} data-testid="sugestao-falantes">
      {/* Sem aria-live: o clique leva o foco a este texto (lido uma vez) e o toast anuncia o resto. */}
      <p ref={textoRef} tabIndex={-1} className={styles.texto}>
        {principal}
      </p>
      {novos.length > 0 && semVaga ? (
        <p className={styles.nota}>
          {`A lista já tem o limite de ${String(LIMITE_PARTICIPANTES)} ${pessoa.plural}: ninguém mais pode ser adicionado.`}
        </p>
      ) : null}
      {novos.length > 0 && !semVaga ? (
        <Button onClick={adicionar}>
          {`Adicionar como ${plural(novos.length, pessoa.singular, pessoa.plural)}`}
        </Button>
      ) : null}
      <p className={styles.nota}>
        {`Quem participou sem falar não aparece na transcrição — inclua à mão no bloco ${String(NUMERO_BLOCO.participantes)}.`}
      </p>
    </div>
  );
}
