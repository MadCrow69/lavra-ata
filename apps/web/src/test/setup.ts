import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// O jsdom não implementa a rolagem; o que importa nos testes é o foco.
Element.prototype.scrollIntoView = () => undefined;

// Sem `globals`, o Testing Library não registra o cleanup sozinho.
afterEach(() => {
  cleanup();
  // Depois do cleanup: desmontar o Workbench grava o rascunho pendente, e isso não pode vazar
  // para o teste seguinte do mesmo arquivo.
  sessionStorage.clear();
  localStorage.clear();
});
