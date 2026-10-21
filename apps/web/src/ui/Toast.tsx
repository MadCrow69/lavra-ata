import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { DURACAO_TOAST_MS } from '../config/ui';
import styles from './Toast.module.css';

export interface ToastDados {
  titulo: string;
  /** Linhas complementares (ex.: "OpenAI falhou: limite de uso"). Texto puro. */
  detalhes?: string[];
}

interface ToastApi {
  mostrar: (dados: ToastDados) => void;
}

interface ToastAtivo extends ToastDados {
  id: number;
}

const ToastContext = createContext<ToastApi | null>(null);

function ItemToast({
  toast,
  duracaoMs,
  onFechar,
}: {
  toast: ToastAtivo;
  duracaoMs: number;
  onFechar: (id: number) => void;
}) {
  const [sobMouse, setSobMouse] = useState(false);
  const [comFoco, setComFoco] = useState(false);
  const restanteRef = useRef(duracaoMs);
  /** Quem tinha o foco antes de ele entrar nas notificações (para devolver ao fechar). */
  const origemRef = useRef<HTMLElement | null>(null);
  const pausado = sobMouse || comFoco;

  // Fechar pelo botão não deixa o foco cair no <body>: vai ao toast vizinho ou de volta à origem.
  const fecharPeloBotao = (botao: HTMLElement) => {
    const item = botao.closest('[data-toast]');
    const ativo = document.activeElement;
    if (item && (ativo === null || ativo === document.body || item.contains(ativo))) {
      const vizinho = (
        item.nextElementSibling ?? item.previousElementSibling
      )?.querySelector<HTMLElement>('button');
      const origem = origemRef.current?.isConnected ? origemRef.current : null;
      (vizinho ?? origem)?.focus();
    }
    onFechar(toast.id);
  };

  // O cronômetro só corre sem mouse em cima e sem foco dentro; ao pausar, guarda o que falta.
  useEffect(() => {
    if (pausado) return;
    const inicio = Date.now();
    const timer = setTimeout(() => {
      onFechar(toast.id);
    }, restanteRef.current);
    return () => {
      clearTimeout(timer);
      restanteRef.current = Math.max(0, restanteRef.current - (Date.now() - inicio));
    };
  }, [pausado, onFechar, toast.id]);

  return (
    <div
      className={styles.toast}
      data-toast=""
      onMouseEnter={() => {
        setSobMouse(true);
      }}
      onMouseLeave={() => {
        setSobMouse(false);
      }}
      onFocus={(e) => {
        const veio = e.relatedTarget;
        if (veio instanceof HTMLElement && !veio.closest('[data-toast-regiao]')) {
          origemRef.current = veio;
        }
        setComFoco(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setComFoco(false);
      }}
    >
      <div className={styles.conteudo}>
        <p className={styles.titulo}>{toast.titulo}</p>
        {toast.detalhes?.map((linha) => (
          // `mostrar` tira as linhas repetidas: o texto identifica a linha.
          <p key={linha} className={styles.detalhe}>
            {linha}
          </p>
        ))}
      </div>
      <button
        type="button"
        className={styles.fechar}
        aria-label="Fechar notificação"
        onClick={(e) => {
          fecharPeloBotao(e.currentTarget);
        }}
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}

/**
 * Notificações curtas, empilhadas no canto da tela. A região `aria-live="polite"` existe desde a
 * montagem (leitores de tela só anunciam mudanças em regiões já presentes). Cada toast some após
 * `duracaoMs`, com pausa enquanto o mouse está em cima ou o foco está dentro; o botão fecha na hora.
 */
export function ToastProvider({
  children,
  duracaoMs = DURACAO_TOAST_MS,
}: {
  children: ReactNode;
  duracaoMs?: number;
}) {
  const [toasts, setToasts] = useState<ToastAtivo[]>([]);
  const proximoIdRef = useRef(1);

  const fechar = useCallback((id: number) => {
    setToasts((atual) => atual.filter((t) => t.id !== id));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      mostrar(dados) {
        const id = proximoIdRef.current++;
        const detalhes = [...new Set(dados.detalhes ?? [])];
        setToasts((atual) => [...atual, { titulo: dados.titulo, detalhes, id }]);
      },
    }),
    [],
  );

  return (
    <ToastContext value={api}>
      {children}
      <div
        className={styles.regiao}
        role="region"
        aria-label="Notificações"
        data-toast-regiao=""
        aria-live="polite"
        aria-relevant="additions text"
      >
        {toasts.map((t) => (
          <ItemToast key={t.id} toast={t} duracaoMs={duracaoMs} onFechar={fechar} />
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const api = use(ToastContext);
  if (!api) throw new Error('useToast precisa estar dentro de <ToastProvider>.');
  return api;
}
