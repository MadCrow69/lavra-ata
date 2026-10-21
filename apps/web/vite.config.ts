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
  build: {
    // Nenhum asset vira data: URI — img-src/font-src exigem arquivos reais.
    assetsInlineLimit: 0,
  },
});
