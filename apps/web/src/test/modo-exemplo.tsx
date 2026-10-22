import { useState, type ReactNode } from 'react';
import { ModoExemploProvider } from '../features/exemplo/ModoExemplo';

/**
 * Modo exemplo controlado pelo teste: começa desligado (ou ligado) e o botão "Ligar o modo exemplo"
 * o liga depois — para provar que um estado já na tela (erro com "Tentar de novo") também para.
 */
export function ModoExemploDeTeste({
  children,
  ligado = false,
}: {
  children: ReactNode;
  ligado?: boolean;
}) {
  const [ativo, setAtivo] = useState(ligado);
  return (
    <ModoExemploProvider valor={{ tipoId: ativo ? 'corporativa' : null, logo: null }}>
      <button
        type="button"
        onClick={() => {
          setAtivo(true);
        }}
      >
        Ligar o modo exemplo
      </button>
      {children}
    </ModoExemploProvider>
  );
}
