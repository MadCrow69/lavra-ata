import { useId, useRef, useState } from 'react';
import { ATA_TYPES, obterTipo } from '../../ata-types/registry';
import type { AtaTypeDefinition } from '../../ata-types/types';
import { useDraft } from '../../domain/DraftContext';
import { TONS, type Tom } from '../../domain/draft';
import { MOTIVO_IA_OCUPADA, useOperacaoIA } from '../../generation/OperacaoIA';
import { usePreferencias } from '../../preferencias/PreferenciasContext';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { DestaqueField } from './DestaqueField';
import { FormBlock } from './FormBlock';
import { LembrarPreferencias } from './LembrarPreferencias';
import { LogoField } from './LogoField';
import styles from './form.module.css';

const ROTULO_TOM: Record<Tom, string> = {
  formal: 'Formal (padrão)',
  conciso: 'Conciso (cerca de metade do tamanho)',
  detalhado: 'Detalhado (cerca do dobro, sem inventar fatos)',
};

/** Bloco 1: tipo de ata, tom da redação e logo (opcional). Sempre completo: tudo tem valor padrão. */
export function TipoBlock() {
  const { state, dispatch } = useDraft();
  const grupoId = useId();
  const motivoId = useId();
  const { operacao } = useOperacaoIA();
  const { mostrar } = useToast();
  const preferencias = usePreferencias();
  const atual = obterTipo(state.tipoId);
  const iaOcupada = operacao !== null;
  /** Tipo escolhido que espera a confirmação de descartar a ata gerada. */
  const [pendente, setPendente] = useState<AtaTypeDefinition | null>(null);
  const manterRef = useRef<HTMLButtonElement>(null);

  const trocar = (tipo: AtaTypeDefinition, descartou: boolean) => {
    dispatch({ type: 'definirTipo', tipoId: tipo.id });
    preferencias.definir({ tipoId: tipo.id });
    mostrar({
      titulo: descartou
        ? `Tipo de ata: ${tipo.rotulo}. A ata gerada foi descartada; confira os campos marcados em “falta”.`
        : `Tipo de ata: ${tipo.rotulo}. Confira os campos marcados em “falta”.`,
    });
  };

  const escolher = (tipo: AtaTypeDefinition) => {
    if (tipo.id === atual.id) return;
    if (state.resultado === null) trocar(tipo, false);
    else setPendente(tipo);
  };

  return (
    <FormBlock numero={1} titulo="Tipo de ata e logo" faltando={[]}>
      <fieldset className={styles.grupo}>
        <legend className={styles.grupoLegenda}>Tipo de ata</legend>
        {Object.values(ATA_TYPES).map((tipo) => (
          <label key={tipo.id} className={styles.opcaoTipo}>
            <input
              type="radio"
              name={grupoId}
              value={tipo.id}
              checked={atual.id === tipo.id}
              disabled={iaOcupada}
              aria-describedby={iaOcupada ? motivoId : undefined}
              onChange={() => {
                escolher(tipo);
              }}
            />
            <span>
              <strong>{tipo.rotulo}</strong>
              <span className={styles.opcaoDescricao}>{tipo.descricao}</span>
            </span>
          </label>
        ))}
        {iaOcupada ? (
          <p id={motivoId} className={styles.opcaoDescricao}>
            {MOTIVO_IA_OCUPADA}
          </p>
        ) : null}
      </fieldset>
      <div className={styles.grade}>
        <Field rotulo="Tom da redação">
          {(controle) => (
            <select
              {...controle}
              value={state.tom}
              onChange={(e) => {
                const tom = TONS.find((t) => t === e.target.value);
                if (!tom) return;
                dispatch({ type: 'definirTom', tom });
                preferencias.definir({ tom });
              }}
            >
              {TONS.map((tom) => (
                <option key={tom} value={tom}>
                  {ROTULO_TOM[tom]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <DestaqueField />
      <LembrarPreferencias />
      <LogoField />
      <Modal
        aberto={pendente !== null}
        titulo="Trocar o tipo de ata?"
        focoInicial={manterRef}
        onFechar={() => {
          setPendente(null);
        }}
        acoes={
          <>
            <Button
              variante="perigo"
              onClick={() => {
                if (pendente) trocar(pendente, true);
                setPendente(null);
              }}
            >
              Trocar e descartar a ata gerada
            </Button>
            <Button
              ref={manterRef}
              onClick={() => {
                setPendente(null);
              }}
            >
              {`Manter “${atual.rotulo}”`}
            </Button>
          </>
        }
      >
        <p>
          {`A ata gerada para “${atual.rotulo}” será descartada, porque as seções mudam de um tipo para outro. Dados da reunião em comum, pauta, participantes e transcrição são mantidos; os campos novos aparecem marcados em “falta”.`}
        </p>
      </Modal>
    </FormBlock>
  );
}
