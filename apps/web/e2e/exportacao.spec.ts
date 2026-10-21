import { readFile } from 'node:fs/promises';
import type { Download, Locator, Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { extractText } from 'unpdf';
import {
  CHAVE_OPENAI,
  CPF,
  FOLGA_FALLBACK_MS,
  colarParticipantes,
  configurarChaves,
  expect,
  folha,
  preencherDados,
  preencherReuniao,
  test,
  violacoesDeCsp,
  type Rede,
} from './apoio';
import {
  LOGO_GIF_DISFARCADO,
  LOGO_GRANDE_DEMAIS,
  LOGO_PNG,
  LOGO_PNG_GIGANTE,
  LOGO_SVG_HOSTIL,
} from './fixtures/logos';

/** Teto de tempo do PDF de 200 participantes × 200 encaminhamentos (spec: volume). */
const TEMPO_MAXIMO_VOLUME_MS = 15_000;
const NOME_PDF = 'ata-corporativa-2026-10-14.pdf';
const NOME_DOCX = 'ata-corporativa-2026-10-14.docx';
const MOTIVO_IA_OCUPADA = 'Aguarde a geração em andamento terminar.';

const GERADOR_PDF = /\/assets\/gerar-pdf-[^/]+\.js$/;
const GERADOR_DOCX = /\/assets\/gerar-docx-[^/]+\.js$/;

const espacos = (texto: string) => texto.replace(/\s+/g, ' ');

interface Baixado {
  nome: string;
  bytes: Uint8Array;
}

async function lerDownload(download: Download): Promise<Baixado> {
  const caminho = await download.path();
  return { nome: download.suggestedFilename(), bytes: new Uint8Array(await readFile(caminho)) };
}

/**
 * Clica no botão de exportação e devolve o arquivo baixado. Se a ata tiver lacunas (ou algo mais
 * a confirmar), aceita o modal "Baixar mesmo assim" e segue.
 */
async function baixar(page: Page, botao: string): Promise<Baixado & { ms: number }> {
  const inicio = Date.now();
  const baixou = page.waitForEvent('download');
  const modal = page.getByRole('dialog');
  const decisao = Promise.race([
    baixou.then(() => 'baixou' as const),
    modal.waitFor({ state: 'visible' }).then(() => 'modal' as const),
  ]);
  // Quem perder a corrida não pode virar rejeição solta quando a página fechar.
  decisao.catch(() => undefined);
  await page.getByRole('button', { name: botao }).click();
  if ((await decisao) === 'modal') {
    await modal.getByRole('button', { name: 'Baixar mesmo assim' }).click();
  }
  const arquivo = await lerDownload(await baixou);
  return { ...arquivo, ms: Date.now() - inicio };
}

async function textoDoPdf(bytes: Uint8Array): Promise<{ paginas: string[]; total: number }> {
  // pdf.js pode transferir o buffer: extrai de uma cópia.
  const { text, totalPages } = await extractText(bytes.slice(), { mergePages: false });
  return { paginas: text.map(espacos), total: totalPages };
}

function partesDoDocx(bytes: Uint8Array): Map<string, Uint8Array> {
  return new Map(Object.entries(unzipSync(bytes)));
}

function xmlDoDocx(bytes: Uint8Array): string {
  const documento = partesDoDocx(bytes).get('word/document.xml');
  if (documento === undefined) throw new Error('word/document.xml ausente no .docx');
  return strFromU8(documento);
}

const comeca = (bytes: Uint8Array, texto: string) =>
  new TextDecoder('latin1').decode(bytes.subarray(0, texto.length)) === texto;

/** Chaves + dados + clique em "Gerar ata"; espera a folha mostrar os encaminhamentos. */
async function gerarAta(page: Page, preencher: () => Promise<void> = () => preencherReuniao(page)) {
  await configurarChaves(page, { OpenAI: CHAVE_OPENAI });
  await preencher();
  await page.getByRole('button', { name: /Gerar ata/ }).click();
  await expect(page.getByText('Ata gerada por OpenAI · gpt-6-luna')).toBeVisible({
    timeout: FOLGA_FALLBACK_MS,
  });
  await expect(folha(page).getByRole('heading', { name: 'Encaminhamentos' })).toBeVisible();
}

/** Nada fora do app e dos provedores, nenhuma violação de CSP e nenhum erro no console. */
async function afirmarLimpo(page: Page, rede: Rede) {
  expect(rede.violacoes).toEqual([]);
  expect(await violacoesDeCsp(page)).toEqual([]);
  expect(rede.errosDePagina).toEqual([]);
}

function geradoresPedidos(rede: Rede) {
  return {
    pdf: rede.arquivosDoApp.some((caminho) => GERADOR_PDF.test(caminho)),
    docx: rede.arquivosDoApp.some((caminho) => GERADOR_DOCX.test(caminho)),
  };
}

function barraDeExportacao(page: Page): Locator {
  return page.getByRole('group', { name: 'Exportar a ata' });
}

test.describe('exportação no build com CSP ativa', () => {
  test.use({ cenario: { openai: 'ok' } });

  test('baixa PDF e DOCX válidos; os geradores só são pedidos no primeiro clique', async ({
    app: page,
    rede,
  }) => {
    // Antes de gerar e de exportar, nenhum chunk dos geradores foi pedido (carga sob demanda).
    expect(geradoresPedidos(rede)).toEqual({ pdf: false, docx: false });
    expect(rede.arquivosDoApp.some((caminho) => /\/assets\/index-[^/]+\.js$/.test(caminho))).toBe(
      true,
    );

    await gerarAta(page);
    await expect(barraDeExportacao(page).getByRole('button', { name: 'Baixar PDF' })).toBeEnabled();
    expect(geradoresPedidos(rede)).toEqual({ pdf: false, docx: false });
    // O título é o primeiro cabeçalho da folha.
    const tituloDaFolha = (await folha(page).getByRole('heading').first().innerText()).trim();
    expect(tituloDaFolha).not.toBe('');

    // PDF: só o chunk do PDF é pedido (controle positivo da observação de requisições).
    const pdf = await baixar(page, 'Baixar PDF');
    expect(geradoresPedidos(rede)).toEqual({ pdf: true, docx: false });
    expect(pdf.nome).toBe(NOME_PDF);
    expect(comeca(pdf.bytes, '%PDF-')).toBe(true);
    const { paginas, total } = await textoDoPdf(pdf.bytes);
    const texto = paginas.join(' ');
    for (const esperado of [
      tituloDaFolha,
      'Encaminhamentos',
      'Joana Prado',
      'Discussão por item de pauta',
      'Decisões',
      'Próxima reunião',
      CPF,
    ]) {
      expect(texto).toContain(esperado);
    }
    expect(texto).not.toContain('[CPF_');
    expect(paginas[0]).toContain(`Página 1 de ${String(total)}`);
    await expect(page.getByText('PDF baixado')).toBeVisible();

    // DOCX: agora o chunk do DOCX também.
    const docx = await baixar(page, 'Baixar DOCX');
    expect(geradoresPedidos(rede)).toEqual({ pdf: true, docx: true });
    expect(docx.nome).toBe(NOME_DOCX);
    expect(comeca(docx.bytes, 'PK')).toBe(true);
    const xml = xmlDoDocx(docx.bytes);
    for (const esperado of [tituloDaFolha, 'Joana Prado', 'Encaminhamentos', 'Decisões', CPF]) {
      expect(xml).toContain(esperado);
    }
    expect(xml).not.toContain('[CPF_');
    await expect(page.getByText('DOCX baixado')).toBeVisible();

    await afirmarLimpo(page, rede);
  });

  test('logo: PNG entra; SVG hostil vira PNG sem executar nada; arquivos hostis são recusados', async ({
    app: page,
    rede,
  }) => {
    const bloco = page.getByRole('group', { name: /Logo da organização/ });
    const logoNaFolha = folha(page).locator('img[src^="data:image/png"]');
    const erro = bloco.getByRole('alert');

    // PNG válido: aparece na folha.
    await bloco.getByLabel('Arquivo da logo').setInputFiles(LOGO_PNG);
    await expect(logoNaFolha).toBeVisible();
    const srcDoPng = await logoNaFolha.getAttribute('src');

    // SVG com <script>, onload e imagem externa: rasterizado como PNG, sem executar e sem rede.
    await bloco.getByLabel('Arquivo da nova logo').setInputFiles(LOGO_SVG_HOSTIL);
    await expect.poll(() => logoNaFolha.getAttribute('src')).not.toBe(srcDoPng);
    await expect(logoNaFolha).toHaveAttribute('src', /^data:image\/png;base64,/);
    await expect(erro).toBeHidden();
    expect(await page.evaluate(() => 'svgExecutou' in window || '__svgExecutou' in window)).toBe(
      false,
    );
    const srcDoSvg = await logoNaFolha.getAttribute('src');

    // Arquivos recusados mostram a causa com ação e deixam a logo atual onde está.
    await bloco.getByLabel('Arquivo da nova logo').setInputFiles(LOGO_GIF_DISFARCADO);
    await expect(erro).toContainText('Formato de logo não aceito');
    await bloco.getByLabel('Arquivo da nova logo').setInputFiles(LOGO_PNG_GIGANTE);
    await expect(erro).toContainText('dimensões fora do aceito');
    await bloco.getByLabel('Arquivo da nova logo').setInputFiles(LOGO_GRANDE_DEMAIS);
    await expect(erro).toContainText('A logo passa de 2 MB');
    await expect(logoNaFolha).toHaveAttribute('src', srcDoSvg ?? '');

    // Exporta com a logo (a rasterizada do SVG hostil): PDF e DOCX saem, o DOCX com a imagem.
    await gerarAta(page);
    const pdf = await baixar(page, 'Baixar PDF');
    expect(pdf.nome).toBe(NOME_PDF);
    expect(comeca(pdf.bytes, '%PDF-')).toBe(true);
    expect((await textoDoPdf(pdf.bytes)).paginas.join(' ')).toContain('Joana Prado');

    const docx = await baixar(page, 'Baixar DOCX');
    const imagens = [...partesDoDocx(docx.bytes).keys()].filter((c) =>
      /^word\/media\/.+\.png$/.test(c),
    );
    expect(imagens.length).toBeGreaterThan(0);
    expect(xmlDoDocx(docx.bytes)).toContain('Joana Prado');

    // "Nova ata" apaga a ata e mantém a logo.
    await page.getByRole('button', { name: 'Nova ata' }).click();
    await page.getByRole('button', { name: 'Apagar e começar' }).click();
    await expect(page.getByText('Nova ata iniciada. Tipo, tom e logo mantidos.')).toBeVisible();
    await expect(logoNaFolha).toHaveAttribute('src', srcDoSvg ?? '');
    await expect(bloco.getByRole('img', { name: 'Logo da organização' })).toBeVisible();

    expect(await page.evaluate(() => '__svgExecutou' in window)).toBe(false);
    // O erro de "arquivo recusado" é mostrado na tela; o console e a rede ficam limpos.
    await afirmarLimpo(page, rede);
  });

  test.describe('volume', () => {
    test.use({ cenario: { openai: 'ok', encaminhamentos: 200 } });

    test('200 participantes e 200 encaminhamentos: PDF em várias páginas, todas com "Página i de N"', async ({
      app: page,
      rede,
    }) => {
      await gerarAta(page, async () => {
        await preencherDados(page);
        await colarParticipantes(
          page,
          Array.from(
            { length: 200 },
            (_, i) =>
              `Pessoa ${String(i + 1).padStart(3, '0')} Teste — Cargo ${String((i % 9) + 1)}`,
          ),
        );
        await page.getByLabel('Transcrição da reunião').fill('Marcos Ferraz: Bom dia a todos.');
      });
      await expect(
        folha(page).getByRole('table', { name: 'Encaminhamentos' }).locator('tbody tr'),
      ).toHaveCount(200);

      const pdf = await baixar(page, 'Baixar PDF');
      expect(pdf.ms).toBeLessThan(TEMPO_MAXIMO_VOLUME_MS);
      expect(comeca(pdf.bytes, '%PDF-')).toBe(true);
      const { paginas, total } = await textoDoPdf(pdf.bytes);
      test.info().annotations.push({
        type: 'pdf-volume',
        description: `${String(total)} páginas em ${String(pdf.ms)} ms`,
      });
      expect(total).toBeGreaterThanOrEqual(5);
      expect(paginas).toHaveLength(total);
      paginas.forEach((pagina, i) => {
        expect(pagina).toContain(`Página ${String(i + 1)} de ${String(total)}`);
      });
      const todo = paginas.join(' ');
      expect(todo).toContain('Pessoa 200 Teste');
      expect(todo).toContain('item 200 do cronograma');

      await afirmarLimpo(page, rede);
    });
  });

  test('copia as tarefas agrupadas por responsável para a área de transferência', async ({
    app: page,
    rede,
  }) => {
    await gerarAta(page);

    await page.getByRole('button', { name: 'Copiar tarefas por responsável' }).click();
    await expect(
      page
        .getByRole('region', { name: 'Notificações' })
        .getByText('Tarefas de 2 pessoas copiadas.'),
    ).toBeVisible();

    // O Windows devolve a área de transferência com CRLF; o app copia LF.
    const copiado = (await page.evaluate(() => navigator.clipboard.readText())).replaceAll(
      '\r\n',
      '\n',
    );
    // Grupos em ordem alfabética; cada tarefa em uma linha, com prazo e status.
    expect(copiado).toBe(
      [
        'Ata de reunião — Migração do cadastro de fornecedores',
        'Reunião de 14/10/2026',
        '',
        'Tarefas por responsável',
        '',
        'Joana Prado',
        '- Enviar o contrato de suporte ao jurídico (prazo: 21/10/2026)',
        '',
        'Marcos Ferraz',
        '- Concluir a migração do cadastro (prazo: 30/11/2026) — Em andamento',
      ].join('\n'),
    );
    expect(copiado).toContain('Joana Prado\n- ');
    // Nenhum modal do plano B: a área de transferência funcionou.
    await expect(page.getByRole('dialog')).toBeHidden();

    await afirmarLimpo(page, rede);
  });

  test('durante a geração, os três botões ficam parados com o motivo', async ({
    app: page,
    rede,
  }) => {
    // A resposta da OpenAI só sai quando o teste a libera; o `fallback` entrega à rede auditada.
    let liberar: () => void = () => undefined;
    const liberada = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    await page.route('https://api.openai.com/**', async (route) => {
      if (route.request().method() === 'POST') await liberada;
      await route.fallback();
    });

    await configurarChaves(page, { OpenAI: CHAVE_OPENAI });
    await preencherReuniao(page);
    await page.getByRole('button', { name: /Gerar ata/ }).click();

    const barra = barraDeExportacao(page);
    for (const nome of ['Baixar PDF', 'Baixar DOCX', 'Copiar tarefas por responsável']) {
      await expect(barra.getByRole('button', { name: nome })).toBeDisabled();
    }
    await expect(barra.getByText(MOTIVO_IA_OCUPADA)).toBeVisible();
    expect(geradoresPedidos(rede)).toEqual({ pdf: false, docx: false });

    liberar();
    await expect(page.getByText('Ata gerada por OpenAI · gpt-6-luna')).toBeVisible({
      timeout: FOLGA_FALLBACK_MS,
    });
    for (const nome of ['Baixar PDF', 'Baixar DOCX', 'Copiar tarefas por responsável']) {
      await expect(barra.getByRole('button', { name: nome })).toBeEnabled();
    }
    await expect(barra.getByText(MOTIVO_IA_OCUPADA)).toBeHidden();

    await afirmarLimpo(page, rede);
  });

  test.describe('celular (360×740)', () => {
    test.use({ viewport: { width: 360, height: 740 } });

    test('a barra cabe na largura e o PDF baixa', async ({ app: page, rede }) => {
      await gerarAta(page);
      // Gerar leva sozinho à aba Documento.
      await expect(page.getByRole('tab', { name: 'Documento' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      const barra = barraDeExportacao(page);
      await expect(barra).toBeVisible();

      const medidas = await page.evaluate(() => {
        const raiz = document.documentElement;
        const conteiner = document
          .querySelector('[role="group"][aria-label="Exportar a ata"]')
          ?.getBoundingClientRect();
        const botoes = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[role="group"][aria-label="Exportar a ata"] button',
          ),
        ).map((b) => b.getBoundingClientRect());
        return {
          rolagem: raiz.scrollWidth,
          largura: raiz.clientWidth,
          direitaDoConteiner: conteiner?.right ?? 0,
          maiorDireitaDosBotoes: Math.max(0, ...botoes.map((b) => b.right)),
          menorEsquerdaDosBotoes: Math.min(Infinity, ...botoes.map((b) => b.left)),
          botoes: botoes.length,
        };
      });
      expect(medidas.botoes).toBe(3);
      expect(medidas.rolagem).toBeLessThanOrEqual(medidas.largura);
      expect(medidas.maiorDireitaDosBotoes).toBeLessThanOrEqual(medidas.direitaDoConteiner + 0.5);
      expect(medidas.menorEsquerdaDosBotoes).toBeGreaterThanOrEqual(-0.5);

      const pdf = await baixar(page, 'Baixar PDF');
      expect(pdf.nome).toBe(NOME_PDF);
      expect(comeca(pdf.bytes, '%PDF-')).toBe(true);
      expect((await textoDoPdf(pdf.bytes)).paginas.join(' ')).toContain('Joana Prado');

      await afirmarLimpo(page, rede);
    });
  });
});
