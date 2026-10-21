import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { CSP } from './csp.config.js';

/**
 * Injeta o <meta> de CSP só no build. O servidor de dev injeta um script inline
 * do React Refresh, que a CSP bloquearia; a CSP é provada no `preview` do build.
 */
function cspMeta(): Plugin {
  return {
    name: 'lavra:csp-meta',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig({
  base: '/lavra-ata/',
  plugins: [react(), cspMeta()],
  define: {
    // SHA do commit do CI; 'dev' em qualquer outro lugar.
    __COMMIT_SHA__: JSON.stringify(process.env.GITHUB_SHA ?? 'dev'),
  },
  build: {
    // Assets referenciados (CSS, `?url`, import comum) não viram data: URI — img-src/font-src da
    // interface exigem arquivos reais. A ÚNICA exceção são os imports `?inline` explícitos das
    // fontes do PDF (`src/export/pdf/arquivos-fonte.ts`): o Vite os inlina mesmo com limite 0, e o
    // base64 vai para o VFS do pdfmake dentro do chunk sob demanda (sem fetch: connect-src não
    // tem 'self').
    assetsInlineLimit: 0,
    // O Vite avisa de chunk acima de 500 kB. O ÚNICO acima disso é o do gerador de PDF (pdfmake +
    // fontes em base64, ~1,25 MB), carregado por `import()` só na primeira exportação, fora da carga
    // inicial (o bundle principal tem ~375 kB). O teto sobe só até cobri-lo. A carga inicial é
    // guardada à parte por `scripts/check-bundle.mjs` (orçamento de 500 kB e nenhum marcador do PDF,
    // do DOCX ou das fontes nela), que roda no fim do `build`.
    chunkSizeWarningLimit: 1300,
  },
});
