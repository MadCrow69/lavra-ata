import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LogoDoc } from '../document/model';
import { criarLogoStore, type LogoStore } from './logo-store';
import { prepararLogo } from './rasterizar-logo';
import { ErroDeLogo, MENSAGEM_ERRO_LOGO } from './validar-logo';

export const AVISO_LOGO_SO_NA_PAGINA =
  'A logo vale só até recarregar a página: o navegador não tinha espaço para guardá-la.';
export const AVISO_LOGO_NAO_LEMBRADA =
  'Não foi possível lembrar a logo neste navegador: ele não tinha espaço ou bloqueou o armazenamento.';

export interface UsoDaLogo {
  logo: LogoDoc | null;
  /** A logo está guardada no `localStorage` (checkbox "Lembrar logo neste navegador"). */
  lembrar: boolean;
  processando: boolean;
  /** Mensagem de erro do último envio (causa + ação), ou `null`. */
  erro: string | null;
  /** Aviso que não impede o uso da logo (ex.: ela não pôde ser guardada no navegador). */
  aviso: string | null;
  enviar: (arquivo: File) => Promise<void>;
  remover: () => void;
  definirLembrar: (v: boolean) => void;
}

const LogoContext = createContext<UsoDaLogo | null>(null);

const processarPadrao = (arquivo: File): Promise<LogoDoc> => prepararLogo(arquivo);

/**
 * Dono da logo do app: o estado fica fora do rascunho da ata (a logo nunca vai para a IA nem
 * para o rascunho). Testes injetam `store` (storage falso) e `processar` (sem canvas).
 */
export function LogoProvider({
  children,
  store,
  processar = processarPadrao,
}: {
  children: ReactNode;
  store?: LogoStore;
  processar?: (arquivo: File) => Promise<LogoDoc>;
}) {
  const [instancia] = useState<LogoStore>(() => store ?? criarLogoStore());
  const [logo, setLogo] = useState<LogoDoc | null>(() => instancia.atual());
  const [lembrar, setLembrar] = useState(() => instancia.lembrar());
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Só o último envio vale: uma imagem que demora não pode sobrescrever a que veio depois. */
  const envioRef = useRef(0);

  const enviar = useCallback(
    async (arquivo: File): Promise<void> => {
      const envio = ++envioRef.current;
      setErro(null);
      setAviso(null);
      setProcessando(true);
      try {
        const nova = await processar(arquivo);
        if (envio !== envioRef.current) return;
        const { persistiu } = instancia.definir(nova);
        setLogo(nova);
        setLembrar(instancia.lembrar());
        if (!persistiu) setAviso(AVISO_LOGO_SO_NA_PAGINA);
      } catch (e) {
        if (envio !== envioRef.current) return;
        // Só a mensagem do app: texto de erro do navegador pode trazer dados do arquivo.
        setErro(e instanceof ErroDeLogo ? e.message : MENSAGEM_ERRO_LOGO.ilegivel);
      } finally {
        if (envio === envioRef.current) setProcessando(false);
      }
    },
    [instancia, processar],
  );

  const remover = useCallback(() => {
    envioRef.current++;
    instancia.remover();
    setLogo(null);
    setLembrar(false);
    setProcessando(false);
    setErro(null);
    setAviso(null);
  }, [instancia]);

  const definirLembrar = useCallback(
    (v: boolean) => {
      const { persistiu } = instancia.definirLembrar(v);
      setLembrar(instancia.lembrar());
      setAviso(v && !persistiu ? AVISO_LOGO_NAO_LEMBRADA : null);
    },
    [instancia],
  );

  const valor = useMemo<UsoDaLogo>(
    () => ({ logo, lembrar, processando, erro, aviso, enviar, remover, definirLembrar }),
    [logo, lembrar, processando, erro, aviso, enviar, remover, definirLembrar],
  );
  return <LogoContext value={valor}>{children}</LogoContext>;
}

/** A logo do app e as ações sobre ela. Só funciona dentro de `<LogoProvider>`. */
export function useLogo(): UsoDaLogo {
  const valor = use(LogoContext);
  if (!valor) throw new Error('useLogo precisa estar dentro de <LogoProvider>.');
  return valor;
}
