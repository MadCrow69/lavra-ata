import { Button } from '../../ui/Button';
import styles from './exemplo.module.css';

export interface BannerExemploProps {
  /** Rótulo do tipo do exemplo na tela. */
  rotulo: string;
  onComecarMinha: () => void;
}

/**
 * Aviso do modo exemplo, logo abaixo do cabeçalho e visível nas duas abas: diz que nada foi
 * enviado para IA e oferece a saída ("Começar a minha").
 */
export function BannerExemplo({ rotulo, onComecarMinha }: BannerExemploProps) {
  return (
    <section className={styles.banner} aria-label="Modo exemplo">
      <div className={styles.bannerTexto}>
        <p className={styles.bannerTitulo}>
          Você está vendo um exemplo — nada foi enviado para IA.
        </p>
        <p className={styles.bannerDetalhe}>{`Exemplo: ${rotulo}. Dados e pessoas fictícios.`}</p>
      </div>
      <Button variante="primario" onClick={onComecarMinha}>
        Começar a minha
      </Button>
    </section>
  );
}
