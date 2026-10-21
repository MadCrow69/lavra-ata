import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('monta a casca do produto: cabeçalho, painéis Editar e Documento e rodapé', () => {
    render(<App />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configurar chaves de IA' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Documento' })).toBeInTheDocument();
  });
});
