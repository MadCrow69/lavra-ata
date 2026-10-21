import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DraftProvider, useDraft } from './DraftContext';

describe('useDraft', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lança erro claro fora do provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useDraft())).toThrow(/DraftProvider/);
  });

  it('expõe state e dispatch', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DraftProvider>{children}</DraftProvider>
    );
    const { result } = renderHook(() => useDraft(), { wrapper });
    expect(result.current.state.versao).toBe(1);
    act(() => {
      result.current.dispatch({ type: 'definirTom', tom: 'conciso' });
    });
    expect(result.current.state.tom).toBe('conciso');
  });
});
