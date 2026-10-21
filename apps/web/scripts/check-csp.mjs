// Falha o build se o HTML gerado não cumprir a CSP do Lavra.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CSP } from '../csp.config.js';
import { verificarCsp } from './csp-verify.mjs';

const indexPath = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const erros = verificarCsp(readFileSync(indexPath, 'utf8'), CSP);

if (erros.length > 0) {
  console.error('Verificação da CSP falhou:');
  for (const erro of erros) {
    console.error(`  - ${erro}`);
  }
  process.exit(1);
}

console.log('CSP verificada em dist/index.html');
