import { useState } from 'react';
import { KeysProvider } from './ai/KeysContext';
import { KeysModal } from './features/keys/KeysModal';
import { AppShell } from './shell/AppShell';

export function App() {
  const [chavesAbertas, setChavesAbertas] = useState(false);

  return (
    <KeysProvider>
      <AppShell
        onConfigurarChaves={() => {
          setChavesAbertas(true);
        }}
        editar={<p>Em breve: tipo de ata, dados da reunião, participantes e transcrição.</p>}
        documento={<p>Em breve: a folha da ata aparece aqui, atualizada ao vivo.</p>}
      />
      <KeysModal
        aberto={chavesAbertas}
        onFechar={() => {
          setChavesAbertas(false);
        }}
      />
    </KeysProvider>
  );
}
