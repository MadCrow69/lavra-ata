// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MARCADORES_EXEMPLO,
  MARCADORES_SOB_DEMANDA,
  ORCAMENTO_CARGA_INICIAL_BYTES,
  arquivosDaCargaInicial,
  verificarCargaInicial,
  verificarOrcamento,
} from './bundle-verify.mjs';

const BASE = '/lavra-ata/assets/';

function pagina(head: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">${head}</head><body><div id="root"></div></body></html>`;
}

const ENTRADA = `<script type="module" crossorigin src="${BASE}index-abc.js"></script>`;
const ESTILO = `<link rel="stylesheet" crossorigin href="${BASE}index-abc.css">`;
const PRELOAD = `<link rel="modulepreload" crossorigin href="${BASE}vendor-abc.js">`;

/** Leitor falso: caminho (como escrito no HTML) → conteúdo; `null` = arquivo ausente. */
function leitor(arquivos: Record<string, string>) {
  return (caminho: string): string | null => arquivos[caminho] ?? null;
}

describe('MARCADORES_SOB_DEMANDA', () => {
  it('cobre fontes WOFF em base64, pdfkit, docx e os dados dos exemplos', () => {
    expect(MARCADORES_SOB_DEMANDA).toEqual([
      'd09GRg',
      '%PDF-',
      'word/document.xml',
      ...MARCADORES_EXEMPLO,
    ]);
  });
});

describe('MARCADORES_EXEMPLO', () => {
  const EXEMPLOS = new URL('../src/exemplos/', import.meta.url);
  const DADOS = new URL('dados/', EXEMPLOS);

  it('é o CPF fictício que só os dados dos exemplos citam', () => {
    expect(MARCADORES_EXEMPLO).toEqual(['529.982.247-25']);
  });

  it('ficticios.ts contém cada marcador de exemplo', () => {
    const ficticios = readFileSync(new URL('ficticios.ts', EXEMPLOS), 'utf8');

    for (const marcador of MARCADORES_EXEMPLO) expect(ficticios).toContain(marcador);
  });

  it('todo arquivo de dados dos exemplos importa os identificadores de ../ficticios', () => {
    const arquivos = readdirSync(DADOS).filter((nome) => nome.endsWith('.ts'));

    expect(arquivos.length).toBeGreaterThanOrEqual(4);
    for (const nome of arquivos) {
      expect(readFileSync(new URL(nome, DADOS), 'utf8'), nome).toMatch(/from '\.\.\/ficticios'/);
    }
  });
});

describe('arquivosDaCargaInicial', () => {
  it('lista script de entrada, modulepreload e CSS, na ordem do HTML', () => {
    expect(arquivosDaCargaInicial(pagina(`${ENTRADA}${PRELOAD}${ESTILO}`))).toEqual({
      scripts: [`${BASE}index-abc.js`, `${BASE}vendor-abc.js`],
      estilos: [`${BASE}index-abc.css`],
    });
  });

  it('ignora script inline, link de outro tipo e tags dentro de comentário', () => {
    const html = pagina(
      `<!-- ${PRELOAD} --><script>1</script><link rel="icon" href="/x.svg"><link rel="prefetch" href="${BASE}gerar-pdf.js">${ENTRADA}`,
    );

    expect(arquivosDaCargaInicial(html)).toEqual({ scripts: [`${BASE}index-abc.js`], estilos: [] });
  });
});

describe('verificarCargaInicial', () => {
  const html = pagina(`${ENTRADA}${PRELOAD}${ESTILO}`);
  const limpos = {
    [`${BASE}index-abc.js`]: 'console.log("app")',
    [`${BASE}vendor-abc.js`]: 'export const a = 1',
    [`${BASE}index-abc.css`]: 'body{margin:0}',
  };

  it('aprova a carga inicial sem nenhum marcador', () => {
    expect(verificarCargaInicial(html, leitor(limpos))).toEqual([]);
  });

  it.each(MARCADORES_SOB_DEMANDA)(
    'reprova o marcador %s no script de entrada, com o nome do arquivo',
    (marcador) => {
      const problemas = verificarCargaInicial(
        html,
        leitor({ ...limpos, [`${BASE}index-abc.js`]: `x="${marcador}"` }),
      );

      expect(problemas).toEqual([
        `${BASE}index-abc.js contém ${marcador}: um módulo sob demanda (PDF/DOCX, fontes ou dados dos exemplos) entrou na carga inicial`,
      ]);
    },
  );

  it('reprova o marcador num modulepreload', () => {
    const problemas = verificarCargaInicial(
      html,
      leitor({ ...limpos, [`${BASE}vendor-abc.js`]: 'x="word/document.xml"' }),
    );

    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain(`${BASE}vendor-abc.js contém word/document.xml`);
  });

  it('reprova o marcador no CSS inicial (fonte embutida em base64)', () => {
    const problemas = verificarCargaInicial(
      html,
      leitor({
        ...limpos,
        [`${BASE}index-abc.css`]: '@font-face{src:url(data:font/woff;base64,d09GRgABAAA)}',
      }),
    );

    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('index-abc.css contém d09GRg');
  });

  it('aprova quando o marcador está só num chunk dinâmico (fora da carga inicial)', () => {
    const lidos: string[] = [];
    const ler = (caminho: string) => {
      lidos.push(caminho);
      return (
        {
          ...limpos,
          [`${BASE}gerar-pdf-xyz.js`]: 'x="%PDF-" y="d09GRg" z="word/document.xml"',
        }[caminho] ?? null
      );
    };

    expect(verificarCargaInicial(html, ler)).toEqual([]);
    expect(lidos).not.toContain(`${BASE}gerar-pdf-xyz.js`);
  });

  it('reprova arquivo referenciado e inexistente', () => {
    const semVendor = Object.fromEntries(
      Object.entries(limpos).filter(([caminho]) => caminho !== `${BASE}vendor-abc.js`),
    );

    expect(verificarCargaInicial(html, leitor(semVendor))).toEqual([
      `${BASE}vendor-abc.js é referenciado em dist/index.html mas não existe`,
    ]);
  });

  it('reprova um index.html sem script de entrada (a guarda não pode passar no vazio)', () => {
    expect(verificarCargaInicial(pagina(ESTILO), leitor(limpos))).toEqual([
      'dist/index.html não referencia nenhum <script type="module">: a carga inicial não pôde ser verificada',
    ]);
  });
});

describe('verificarOrcamento', () => {
  const html = pagina(`${ENTRADA}${PRELOAD}${ESTILO}`);
  const tamanhos = (t: Record<string, number>) => (caminho: string) => t[caminho] ?? null;

  it('o orçamento é de 500 kB (constante nomeada)', () => {
    expect(ORCAMENTO_CARGA_INICIAL_BYTES).toBe(500_000);
  });

  it('aprova a soma de entrada + modulepreload + CSS dentro do orçamento', () => {
    const t = {
      [`${BASE}index-abc.js`]: 300_000,
      [`${BASE}vendor-abc.js`]: 100_000,
      [`${BASE}index-abc.css`]: 100_000,
    };

    expect(verificarOrcamento(html, tamanhos(t)).problemas).toEqual([]);
    expect(verificarOrcamento(html, tamanhos(t)).total).toBe(500_000);
  });

  it('reprova quando a soma passa do orçamento, com os tamanhos', () => {
    const t = {
      [`${BASE}index-abc.js`]: 400_000,
      [`${BASE}vendor-abc.js`]: 100_000,
      [`${BASE}index-abc.css`]: 1,
    };

    const { problemas, total } = verificarOrcamento(html, tamanhos(t));

    expect(total).toBe(500_001);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('500.001');
    expect(problemas[0]).toContain('500.000');
  });

  it('ignora o arquivo ausente (quem reporta é verificarCargaInicial)', () => {
    expect(verificarOrcamento(html, tamanhos({})).total).toBe(0);
  });
});
