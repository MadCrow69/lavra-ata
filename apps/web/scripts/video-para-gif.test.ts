// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

// Espião do ffmpeg: importar o script não pode chamar nada (a guarda de CLI segura o `main`).
const { execFileSync } = vi.hoisted(() => ({ execFileSync: vi.fn() }));
vi.mock('node:child_process', () => ({ execFileSync }));

const { argumentosFfmpeg, mensagemForaDoOrcamento, ORCAMENTO_GIF_BYTES, OPCOES_GIF } =
  await import('./video-para-gif.mjs');

describe('video-para-gif', () => {
  it('importar o módulo não chama o ffmpeg (guarda de CLI)', () => {
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it('orçamento de 3 MB e opções padrão de 10 fps, 960 px e 24 cores', () => {
    expect(ORCAMENTO_GIF_BYTES).toBe(3_000_000);
    expect(OPCOES_GIF).toEqual({ fps: 10, largura: 960, cores: 24 });
    expect(Object.isFrozen(OPCOES_GIF)).toBe(true);
  });

  it('acima do orçamento, a mensagem diz o tamanho e as quatro saídas do CONTRIBUTING (com cores)', () => {
    expect(mensagemForaDoOrcamento(3_456_789)).toBe(
      'O GIF tem 3.46 MB e o orçamento é 3 MB: reduza fps, largura, cores ou duração.',
    );
  });

  it('primeira passada gera a paleta a partir do vídeo', () => {
    const [paleta] = argumentosFfmpeg('a.webm', 'p.png', 'o.gif');
    expect(paleta).toContain('-i');
    expect(paleta).toContain('a.webm');
    expect(paleta).toContain(
      'fps=10,scale=960:-1:flags=lanczos,palettegen=max_colors=24:stats_mode=diff',
    );
    expect(paleta.at(-1)).toBe('p.png');
  });

  it('segunda passada usa vídeo e paleta como entradas e termina no GIF', () => {
    const [, gif] = argumentosFfmpeg('a.webm', 'p.png', 'o.gif');
    const entradas = gif.flatMap((arg, i) => (gif[i - 1] === '-i' ? [arg] : []));
    expect(entradas).toEqual(['a.webm', 'p.png']);
    expect(gif.at(-1)).toBe('o.gif');
    // O grafo de filtro é UM elemento do array (nunca partido em palavras, como faria um shell).
    const grafos = gif.filter((arg) => arg.includes('paletteuse'));
    expect(grafos).toEqual([
      'fps=10,scale=960:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
    ]);
  });

  it('as opções mudam os números dos filtros', () => {
    const [paleta, gif] = argumentosFfmpeg('a.webm', 'p.png', 'o.gif', {
      fps: 8,
      largura: 800,
      cores: 64,
    });
    expect(paleta).toContain(
      'fps=8,scale=800:-1:flags=lanczos,palettegen=max_colors=64:stats_mode=diff',
    );
    expect(gif).toContain(
      'fps=8,scale=800:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
    );
  });
});
