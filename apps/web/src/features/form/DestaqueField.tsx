import { useId } from 'react';
import { DESTAQUES, DESTAQUE_PADRAO, type OpcaoDestaque } from '../../config/destaque';
import { usePreferencias } from '../../preferencias/PreferenciasContext';
import { useToast } from '../../ui/Toast';
import styles from './destaque.module.css';
import logo from './logo.module.css';

const AJUDA = 'Usada no título e nos títulos de seção da folha, do PDF e do DOCX.';

/**
 * Cor de destaque da folha: a escolha vale na hora (folha, PDF e DOCX) e vai para as preferências;
 * só vai para o `localStorage` se "Lembrar preferências neste navegador" estiver ligado.
 */
export function DestaqueField() {
  const preferencias = usePreferencias();
  const { mostrar } = useToast();
  const grupoId = useId();
  const ajudaId = useId();
  const escolhida = preferencias.atual().destaque ?? DESTAQUE_PADRAO;

  const escolher = (opcao: OpcaoDestaque) => {
    preferencias.definir({ destaque: opcao.id });
    mostrar({
      titulo: `Cor de destaque: ${opcao.rotulo}. A folha, o PDF e o DOCX usam a nova cor.`,
    });
  };

  return (
    <fieldset className={logo.campo} aria-describedby={ajudaId}>
      <legend className={logo.rotulo}>Cor de destaque da folha</legend>
      <p id={ajudaId} className={logo.ajuda}>
        {AJUDA}
      </p>
      <div className={styles.cores}>
        {DESTAQUES.map((opcao) => (
          <label key={opcao.id} className={styles.opcao}>
            <input
              type="radio"
              name={grupoId}
              value={opcao.id}
              checked={escolhida === opcao.id}
              onChange={() => {
                escolher(opcao);
              }}
            />
            <span
              className={styles.amostra}
              aria-hidden="true"
              style={{ backgroundColor: opcao.cor }}
            />
            <span>{opcao.rotulo}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
