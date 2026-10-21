import eslintJs from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/node_modules/', '**/dist/', '**/coverage/', '**/.vitest/', '.superpowers/']),
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    extends: [
      eslintJs.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      eslintReact.configs['recommended-typescript'],
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parser: tseslint.parser,
      parserOptions: {
        // Os arquivos de configuração da raiz são cobertos pelo tsconfig.json da raiz.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // O Lavra nunca injeta HTML cru: toda renderização passa pelo React.
      '@eslint-react/dom-no-dangerously-set-innerhtml': 'error',
    },
  },
  eslintConfigPrettier,
);
