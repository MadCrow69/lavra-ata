import { KeysProvider } from './ai/KeysContext';
import { Workbench } from './features/workbench/Workbench';
import { AvisoContextoInseguro, contextoInseguro, LimiteDeErro } from './shell/LimiteDeErro';
import { ToastProvider } from './ui/Toast';

export function App() {
  if (contextoInseguro()) return <AvisoContextoInseguro />;
  return (
    <LimiteDeErro>
      <KeysProvider>
        <ToastProvider>
          <Workbench />
        </ToastProvider>
      </KeysProvider>
    </LimiteDeErro>
  );
}
