import { useId } from 'react';
import { ATA_TYPES, obterTipo } from '../../ata-types/registry';
import { useDraft } from '../../domain/DraftContext';
import { TONS, type Tom } from '../../domain/draft';
import { Field } from '../../ui/Field';
import { FormBlock } from './FormBlock';
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
  const atual = obterTipo(state.tipoId);

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
              onChange={() => {
                dispatch({ type: 'definirTipo', tipoId: tipo.id });
              }}
            />
            <span>
              <strong>{tipo.rotulo}</strong>
              <span className={styles.opcaoDescricao}>{tipo.descricao}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className={styles.grade}>
        <Field rotulo="Tom da redação">
          {(controle) => (
            <select
              {...controle}
              value={state.tom}
              onChange={(e) => {
                const tom = TONS.find((t) => t === e.target.value);
                if (tom) dispatch({ type: 'definirTom', tom });
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
      <LogoField />
    </FormBlock>
  );
}
