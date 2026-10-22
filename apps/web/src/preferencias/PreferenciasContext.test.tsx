import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreferenciasProvider, usePreferencias, usePreferenciasStore } from './PreferenciasContext';
import { criarPreferenciasStore } from './preferencias-store';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PreferenciasContext', () => {
  it('usePreferencias lança erro claro fora do provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => usePreferencias())).toThrow(
      /precisa estar dentro de <PreferenciasProvider>/,
    );
  });

  it('usePreferenciasStore também lança fora do provider (sem fallback silencioso)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => usePreferenciasStore())).toThrow(
      /precisa estar dentro de <PreferenciasProvider>/,
    );
  });

  it('usePreferencias re-renderiza a cada mudança; usePreferenciasStore não', () => {
    const store = criarPreferenciasStore(null, null);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PreferenciasProvider store={store}>{children}</PreferenciasProvider>
    );
    let rendersStore = 0;
    let rendersAssinante = 0;
    const assinante = renderHook(
      () => {
        rendersAssinante++;
        return usePreferencias();
      },
      { wrapper },
    );
    renderHook(
      () => {
        rendersStore++;
        return usePreferenciasStore();
      },
      { wrapper },
    );
    const antesAssinante = rendersAssinante;
    const antesStore = rendersStore;
    act(() => {
      store.definir({ tom: 'conciso' });
    });
    expect(assinante.result.current.atual().tom).toBe('conciso');
    expect(rendersAssinante).toBeGreaterThan(antesAssinante);
    expect(rendersStore).toBe(antesStore);
  });
});
