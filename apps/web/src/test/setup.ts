import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Arquivos com `@vitest-environment node` (geração de PDF/DOCX) não têm DOM nem storage.
const temDom = typeof Element !== 'undefined';

// O jsdom não implementa a rolagem; o que importa nos testes é o foco.
if (temDom) Element.prototype.scrollIntoView = () => undefined;

// Sem `globals`, o Testing Library não registra o cleanup sozinho.
afterEach(() => {
  if (!temDom) return;
  cleanup();
  // Depois do cleanup: desmontar o Workbench grava o rascunho pendente, e isso não pode vazar
  // para o teste seguinte do mesmo arquivo.
  sessionStorage.clear();
  localStorage.clear();
});
