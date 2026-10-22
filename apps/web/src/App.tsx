import { useState } from 'react';
import { KeysProvider } from './ai/KeysContext';
import { Workbench } from './features/workbench/Workbench';
import { AvisoContextoInseguro, contextoInseguro, LimiteDeErro } from './shell/LimiteDeErro';
import { PreferenciasProvider } from './preferencias/PreferenciasContext';
import { criarPreferenciasStore } from './preferencias/preferencias-store';
import { ToastProvider } from './ui/Toast';

/**
 * As preferências vêm antes das chaves: a ordem lembrada dos provedores é a ordem de partida do
 * `KeyStore` (que, com chaves lembradas, usa a gravada junto com elas).
 */
function AppSeguro() {
  const [preferencias] = useState(() => criarPreferenciasStore());
  const { ordem } = preferencias.atual();
  return (
    <LimiteDeErro>
      <PreferenciasProvider store={preferencias}>
        <KeysProvider {...(ordem ? { ordemInicial: ordem } : {})}>
          <ToastProvider>
            <Workbench />
          </ToastProvider>
        </KeysProvider>
      </PreferenciasProvider>
    </LimiteDeErro>
  );
}

export function App() {
  if (contextoInseguro()) return <AvisoContextoInseguro />;
  return <AppSeguro />;
}
