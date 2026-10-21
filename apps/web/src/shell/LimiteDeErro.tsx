import { Component, type ReactNode } from 'react';
import { Button } from '../ui/Button';
import styles from './LimiteDeErro.module.css';

interface Props {
  children: ReactNode;
  /** Recarrega a página (substituível nos testes). */
  recarregar?: () => void;
}

interface Estado {
  falhou: boolean;
}

function recarregarPagina(): void {
  window.location.reload();
}

/** Tela de falha do app inteiro: causa + ação, sem nunca repetir o texto do erro (pode ter dados). */
export function TelaDeFalha({
  titulo,
  children,
  acao,
}: {
  titulo: string;
  children: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <main className={styles.tela}>
      <div role="alert" className={styles.caixa}>
        <h1 className={styles.titulo}>{titulo}</h1>
        {children}
        {acao}
      </div>
    </main>
  );
}

/**
 * Limite de erro do topo do app: um erro de renderização não deixa a tela em branco. O rascunho
 * fica salvo na sessão desta aba (persistência com debounce), então recarregar o recupera.
 * O texto do erro nunca é exibido nem registrado aqui: pode conter dados da transcrição.
 */
export class LimiteDeErro extends Component<Props, Estado> {
  override state: Estado = { falhou: false };

  static getDerivedStateFromError(): Estado {
    return { falhou: true };
  }

  override render() {
    if (!this.state.falhou) return this.props.children;
    const recarregar = this.props.recarregar ?? recarregarPagina;
    return (
      <TelaDeFalha
        titulo="O Lavra encontrou um erro inesperado"
        acao={
          <Button variante="primario" onClick={recarregar}>
            Recarregar a página (o rascunho desta aba está salvo)
          </Button>
        }
      >
        <p className={styles.texto}>
          A tela parou por um erro no aplicativo. Recarregue a página para continuar de onde parou.
          Se o erro se repetir, abra uma nova aba (o rascunho desta aba é perdido ao fechá-la).
        </p>
      </TelaDeFalha>
    );
  }
}

/**
 * O app precisa de contexto seguro (HTTPS ou localhost): fora dele o navegador desliga
 * `crypto.randomUUID`, usado para identificar participantes. O jsdom não define
 * `isSecureContext`, por isso só `false` explícito conta.
 */
export function contextoInseguro(): boolean {
  // Lidos sem confiar nos tipos do DOM, que os dão como sempre presentes.
  const seguro: unknown = Reflect.get(window, 'isSecureContext');
  const cripto: unknown = Reflect.get(globalThis, 'crypto');
  const temUuid =
    typeof cripto === 'object' &&
    cripto !== null &&
    typeof Reflect.get(cripto, 'randomUUID') === 'function';
  return seguro === false || !temUuid;
}

export function AvisoContextoInseguro() {
  return (
    <TelaDeFalha titulo="Abra o Lavra por um endereço seguro">
      <p className={styles.texto}>
        O Lavra precisa ser aberto por HTTPS (ou em localhost): fora de uma conexão segura o
        navegador desliga recursos que o aplicativo usa. Abra o endereço oficial, que começa com
        https://, ou rode o projeto localmente.
      </p>
    </TelaDeFalha>
  );
}
