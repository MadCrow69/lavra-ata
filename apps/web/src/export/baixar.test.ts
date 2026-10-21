import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ESPERA_REVOGAR_URL_MS } from '../config/ui';
import { baixarArquivo } from './baixar';

describe('baixarArquivo', () => {
  const criar = vi.fn(() => 'blob:http://localhost/abc');
  const revogar = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    criar.mockClear();
    revogar.mockClear();
    URL.createObjectURL = criar;
    URL.revokeObjectURL = revogar;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('clica num link com download e href blob:, e o tira do DOM', () => {
    let noDomNoClique = false;
    let download = '';
    let href = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      noDomNoClique = document.body.contains(this);
      download = this.download;
      href = this.href;
    });

    baixarArquivo(new Blob(['x']), 'ata-corporativa-2026-10-14.pdf');

    expect(download).toBe('ata-corporativa-2026-10-14.pdf');
    expect(href.startsWith('blob:')).toBe(true);
    expect(noDomNoClique).toBe(true);
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('só revoga a URL depois de ESPERA_REVOGAR_URL_MS', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    baixarArquivo(new Blob(['x']), 'a.pdf');

    expect(revogar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(ESPERA_REVOGAR_URL_MS - 1);
    expect(revogar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revogar).toHaveBeenCalledExactlyOnceWith('blob:http://localhost/abc');
  });
});
