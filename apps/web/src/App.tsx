import { AppShell } from './shell/AppShell';

/** Provisório até o modal de chaves existir (plano 03, task 6). */
function abrirModalDeChaves(): void {
  // TODO(plano 03, task 6): abrir o modal de configuração das chaves de IA.
}

export function App() {
  return (
    <AppShell
      onConfigurarChaves={abrirModalDeChaves}
      editar={<p>Em breve: tipo de ata, dados da reunião, participantes e transcrição.</p>}
      documento={<p>Em breve: a folha da ata aparece aqui, atualizada ao vivo.</p>}
    />
  );
}
