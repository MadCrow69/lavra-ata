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
  },
});
