import { KeysProvider } from './ai/KeysContext';
import { Workbench } from './features/workbench/Workbench';
import { ToastProvider } from './ui/Toast';

export function App() {
  return (
    <KeysProvider>
      <ToastProvider>
        <Workbench />
      </ToastProvider>
    </KeysProvider>
  );
}
