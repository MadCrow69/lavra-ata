import { render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { KeysProvider } from '../ai/KeysContext';
import { criarKeyStore, type KeyStore } from '../ai/keys';
import type { LogoDoc } from '../document/model';
import { DraftProvider } from '../domain/DraftContext';
import type { AtaDraft } from '../domain/draft';
import { OperacaoIAProvider } from '../generation/OperacaoIA';
import { LogoProvider } from '../logo/LogoContext';
import { criarLogoStore, type LogoStore } from '../logo/logo-store';
import { PreferenciasProvider } from '../preferencias/PreferenciasContext';
import { criarPreferenciasStore, type PreferenciasStore } from '../preferencias/preferencias-store';
import { ToastProvider } from '../ui/Toast';

export interface OpcoesProvedores {
  inicial?: AtaDraft;
  keyStore?: KeyStore;
  /** Padrão: logo só em memória (nenhum storage), para um teste não vazar para o seguinte. */
  logoStore?: LogoStore;
  processarLogo?: (arquivo: File) => Promise<LogoDoc>;
  /** Padrão: preferências só em memória (nenhum storage), pelo mesmo motivo da logo. */
  preferenciasStore?: PreferenciasStore;
}

/** Todos os provedores da bancada, na ordem do app, para testar um componente isolado. */
export function Provedores({
  children,
  inicial,
  keyStore,
  logoStore,
  processarLogo,
  preferenciasStore,
}: OpcoesProvedores & { children: ReactNode }) {
  return (
    <PreferenciasProvider store={preferenciasStore ?? criarPreferenciasStore(null, null)}>
      <KeysProvider store={keyStore ?? criarKeyStore(null)}>
        <ToastProvider>
          <LogoProvider
            store={logoStore ?? criarLogoStore(null, null)}
            {...(processarLogo ? { processar: processarLogo } : {})}
          >
            <DraftProvider {...(inicial ? { inicial } : {})}>
              <OperacaoIAProvider>{children}</OperacaoIAProvider>
            </DraftProvider>
          </LogoProvider>
        </ToastProvider>
      </KeysProvider>
    </PreferenciasProvider>
  );
}

export function renderizarComProvedores(
  ui: ReactNode,
  opcoes: OpcoesProvedores = {},
): RenderResult {
  return render(<Provedores {...opcoes}>{ui}</Provedores>);
}
