import {
  CHAVE_GEMINI,
  CHAVE_OPENAI,
  CPF,
  CPF_SO_DIGITOS,
  FOLGA_FALLBACK_MS,
  TRANSCRICAO_BASICA,
  colarComoPessoa,
  colarParticipantes,
  conteudoDosStorages,
  configurarChaves,
  errosInesperados,
  expect,
  folha,
  preencherDados,
  preencherReuniao,
  semRolagemHorizontal,
  test,
  violacoesDeCsp,
} from './apoio';
import { MARCADOR_CPF } from './fixtures/respostas';

/**
 * Transcrição de `tamanho` caracteres no pior formato realista: ~4 mil falas curtas (~50
 * caracteres por linha), com o CPF na primeira. É o que sai de uma exportação de chat/legenda.
 */
function transcricaoGrande(tamanho: number): string {
  const falas: string[] = [`Marcos Ferraz: o documento do sócio é o CPF ${CPF}.`];
  let total = (falas[0]?.length ?? 0) + 1;
  for (let n = 1; total < tamanho; n++) {
    const fala = `Pessoa ${String(n % 200).padStart(3, '0')}: comentário ${String(n)} sobre o cronograma.`;
    falas.push(fala);
    total += fala.length + 1;
  }
  return falas.join('\n').slice(0, tamanho);
}

test.describe('fluxo da ata no build com CSP ativa', () => {
  test('gera a ata com fallback OpenAI → Gemini, restaura o CPF e não vaza nada', async ({
    app: page,
    rede,
  }) => {
    await configurarChaves(page, { OpenAI: CHAVE_OPENAI, 'Google Gemini': CHAVE_GEMINI });
    const botaoIa = page.getByRole('banner').getByRole('button', { name: /^IA: / });
    // Ordem padrão: Gemini primeiro.
    await expect(botaoIa).toContainText('IA: Gemini → OpenAI');
    // A pessoa põe a OpenAI na frente: a escolha dela vence a ordem padrão.
    await botaoIa.click();
    const dialogo = page.getByRole('dialog', { name: 'Chaves de IA' });
    await dialogo.getByRole('button', { name: 'Mover OpenAI para cima' }).click();
    await dialogo.getByRole('button', { name: 'Concluir' }).click();
    await expect(botaoIa).toContainText('IA: OpenAI → Gemini');

    await preencherReuniao(page);
    const gerar = page.getByRole('button', { name: /Gerar ata/ });
    await expect(gerar).toBeEnabled();
    await expect(page.getByText(/Envia para OpenAI · gpt-6-luna \(depois Gemini\)/)).toBeVisible();
    await gerar.click();

    // A OpenAI responde 429 duas vezes (tentativa + 1 retry após 2 s) e a cadeia cai no Gemini.
    await expect(page.getByText('Ata gerada por Gemini · gemini-3.8-flash')).toBeVisible({
      timeout: FOLGA_FALLBACK_MS,
    });
    await expect(
      page.getByRole('region', { name: 'Notificações' }).getByText('OpenAI falhou (limite de uso)'),
    ).toBeVisible();
    // A troca também fica registrada em cada seção, não só no aviso que some (spec 8.1.1).
    await expect(
      folha(page)
        .getByText('Gerado por Gemini · gemini-3.8-flash — OpenAI falhou (limite de uso)')
        .first(),
    ).toBeVisible();

    // A folha tem todas as seções, os encaminhamentos e o CPF restaurado.
    const documento = folha(page);
    for (const titulo of [
      'Resumo',
      'Discussão por item de pauta',
      'Decisões',
      'Pendências',
      'Riscos',
      'Próxima reunião',
      'Encaminhamentos',
    ]) {
      await expect(documento.getByRole('heading', { name: titulo })).toBeVisible();
    }
    await expect(documento).toContainText('Migrar o cadastro de fornecedores até 30/11.');
    await expect(documento.getByRole('table', { name: 'Encaminhamentos' })).toContainText(
      'Enviar o contrato de suporte ao jurídico',
    );
    await expect(documento).toContainText(CPF);
    await expect(documento).not.toContainText(MARCADOR_CPF);

    // A cor de destaque chega à folha pela propriedade no `style` (CSSOM): sem violação de CSP.
    await expect(documento).toHaveCSS('--cor-folha-destaque', '#1a1a1a');
    await expect(documento.getByRole('heading', { name: 'Resumo' })).toHaveCSS(
      'color',
      'rgb(26, 26, 26)',
    );
    expect(await violacoesDeCsp(page)).toEqual([]);

    // O que saiu para os provedores: marcador no lugar do CPF, chave só em header.
    const geracoes = rede.chamadas.filter((c) => c.metodo === 'POST');
    expect(geracoes.filter((c) => c.provedor === 'openai')).toHaveLength(2);
    expect(geracoes.filter((c) => c.provedor === 'gemini')).toHaveLength(1);
    expect(geracoes.filter((c) => c.provedor === 'anthropic')).toHaveLength(0);
    for (const chamada of geracoes) {
      expect(chamada.corpo).toContain(MARCADOR_CPF);
      expect(chamada.corpo).not.toContain(CPF);
      expect(chamada.corpo).not.toContain(CPF_SO_DIGITOS);
      for (const chave of [CHAVE_OPENAI, CHAVE_GEMINI]) {
        expect(chamada.url).not.toContain(chave);
        expect(chamada.corpo).not.toContain(chave);
      }
    }
    expect(geracoes.find((c) => c.provedor === 'gemini')?.headers['x-goog-api-key']).toBe(
      CHAVE_GEMINI,
    );
    expect(geracoes.find((c) => c.provedor === 'openai')?.headers.authorization).toBe(
      `Bearer ${CHAVE_OPENAI}`,
    );

    // Sem chave nos storages (nem no rascunho) e sem nada fora da CSP.
    await expect
      .poll(async () => (await conteudoDosStorages(page)).sessao.length)
      .toBeGreaterThan(0);
    const { local, sessao } = await conteudoDosStorages(page);
    expect(local).toEqual([]);
    expect(sessao.join('\n')).not.toContain(CHAVE_OPENAI);
    expect(sessao.join('\n')).not.toContain(CHAVE_GEMINI);

    expect(rede.violacoes).toEqual([]);
    expect(await violacoesDeCsp(page)).toEqual([]);
    // O navegador loga cada 429 provocado de propósito; nenhum outro erro pode aparecer.
    expect(rede.errosDePagina.some((erro) => erro.includes('status of 429'))).toBe(true);
    expect(errosInesperados(rede)).toEqual([]);
  });

  test.describe('celular (360×740)', () => {
    test.use({ viewport: { width: 360, height: 740 }, cenario: { openai: 'ok' } });

    test('sem rolagem horizontal; as abas Editar e Documento funcionam', async ({
      app: page,
      rede,
    }) => {
      await expect(page.getByRole('tab', { name: 'Editar' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await semRolagemHorizontal(page);

      // 30 participantes com cargo comprido: a lista vira cartões e não pode estourar a largura.
      await configurarChaves(page, { OpenAI: CHAVE_OPENAI });
      await preencherDados(page);
      await colarParticipantes(
        page,
        Array.from(
          { length: 30 },
          (_, i) =>
            `Participante ${String(i + 1)} de Sobrenome Muito Comprido — Coordenação de Operações e Relacionamento`,
        ),
      );
      await page.getByLabel('Transcrição da reunião').fill(TRANSCRICAO_BASICA);
      await semRolagemHorizontal(page);

      // As abas trocam o painel visível sem perder o que foi digitado.
      await page.getByRole('tab', { name: 'Documento' }).click();
      await expect(page.getByRole('tab', { name: 'Documento' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(folha(page)).toBeVisible();
      await expect(page.getByRole('button', { name: /Gerar ata/ })).toBeHidden();
      await semRolagemHorizontal(page);

      await page.getByRole('tab', { name: 'Editar' }).click();
      await expect(page.getByLabel('Organização')).toHaveValue('Instituto Horizonte');
      await expect(page.getByLabel('Transcrição da reunião')).toHaveValue(TRANSCRICAO_BASICA);

      // Gerar leva sozinho à aba Documento; a ata pronta também cabe na largura.
      await page.getByRole('button', { name: /Gerar ata/ }).click();
      await expect(page.getByRole('tab', { name: 'Documento' })).toHaveAttribute(
        'aria-selected',
        'true',
        { timeout: FOLGA_FALLBACK_MS },
      );
      await expect(folha(page).getByRole('heading', { name: 'Decisões' })).toBeVisible();
      await expect(folha(page)).toContainText(CPF);
      await semRolagemHorizontal(page);

      expect(rede.violacoes).toEqual([]);
      expect(await violacoesDeCsp(page)).toEqual([]);
      expect(rede.errosDePagina).toEqual([]);
    });
  });

  test('volume: 200 participantes e 200 mil caracteres continuam utilizáveis', async ({
    app: page,
    rede,
  }) => {
    await configurarChaves(page, { 'Google Gemini': CHAVE_GEMINI });
    await preencherDados(page);

    // 200 participantes de uma vez, pelo "Colar lista".
    const participantes = Array.from(
      { length: 200 },
      (_, i) => `Pessoa ${String(i + 1).padStart(3, '0')} Teste — Cargo ${String((i % 9) + 1)}`,
    );
    await colarParticipantes(page, participantes);
    await expect(page.getByText('200 participantes · 200 presentes')).toBeVisible();

    // 200 mil caracteres em ~4 mil linhas curtas, colados como a pessoa cola (Ctrl+V).
    const transcricao = transcricaoGrande(200_000);
    expect(transcricao).toHaveLength(200_000);
    expect(transcricao.split('\n').length).toBeGreaterThan(3_500);

    const campo = page.getByLabel('Transcrição da reunião');
    const contador = page.getByTestId('contador-transcricao');
    const inicio = Date.now();
    const caminho = await colarComoPessoa(page, campo, transcricao);
    test.info().annotations.push({ type: 'colagem', description: caminho });
    await expect(contador).toContainText(/200\.000 de 300\.000/);
    const duracaoColagem = Date.now() - inicio;
    test.info().annotations.push({ type: 'colagem-ms', description: String(duracaoColagem) });
    expect(duracaoColagem).toBeLessThan(2_000);

    // A prévia de privacidade termina de analisar (debounce + `mask` de 200 mil caracteres)...
    await expect(page.locator('p[data-pendente="false"]')).toBeVisible({ timeout: 15_000 });
    // ...e depois dela uma tecla ainda é atendida na hora.
    const inicioTecla = Date.now();
    await campo.press('x');
    await expect(contador).toContainText(/200\.001 de 300\.000/);
    const duracaoTecla = Date.now() - inicioTecla;
    test.info().annotations.push({ type: 'tecla-ms', description: String(duracaoTecla) });
    expect(duracaoTecla).toBeLessThan(1_000);

    // A folha mostra as 200 linhas da tabela de participantes (e o formulário, também).
    await expect(
      folha(page).getByRole('table', { name: 'Participantes' }).locator('tbody tr'),
    ).toHaveCount(200);
    await expect(
      page.getByRole('region', { name: 'Lista de participantes' }).locator('tbody tr'),
    ).toHaveCount(200);

    // A geração com esse volume termina (só há chave do Gemini: a cadeia vai direto a ele).
    await page.getByRole('button', { name: /Gerar ata/ }).click();
    await expect(page.getByText('Ata gerada por Gemini · gemini-3.8-flash')).toBeVisible({
      timeout: FOLGA_FALLBACK_MS,
    });
    await expect(folha(page)).toContainText(CPF);
    const [chamada] = rede.chamadas.filter((c) => c.metodo === 'POST');
    expect(chamada?.corpo).not.toContain(CPF);
    expect(chamada?.corpo).toContain(MARCADOR_CPF);

    expect(rede.violacoes).toEqual([]);
    expect(await violacoesDeCsp(page)).toEqual([]);
    expect(rede.errosDePagina).toEqual([]);
  });

  test('a auditoria enxerga uma violação de CSP (os "vazios" dos outros testes não são cegos)', async ({
    app: page,
    rede,
  }) => {
    expect(await violacoesDeCsp(page)).toEqual([]);

    // Um host fora da lista: a CSP (connect-src) bloqueia antes de a requisição sair.
    const resultado = await page.evaluate(() =>
      fetch('https://example.com/rastreador').then(
        () => 'saiu',
        () => 'bloqueado',
      ),
    );

    expect(resultado).toBe('bloqueado');
    await expect.poll(() => violacoesDeCsp(page)).toHaveLength(1);
    expect((await violacoesDeCsp(page))[0]).toContain('connect-src');
    expect(rede.violacoes).toEqual([]);
  });

  test('o auditor de rede aborta e registra um host de fora (os "vazios" de violacoes não são cegos)', async ({
    app: page,
    rede,
  }) => {
    expect(rede.violacoes).toEqual([]);

    // Navegação não é governada por `connect-src`: a requisição chega ao `context.route`.
    await page.goto('https://example.com/rastreador').catch(() => undefined);

    expect(rede.violacoes).toContain('GET https://example.com/rastreador');
    expect(rede.chamadas).toEqual([]);
  });

  test('a chave nunca vai para localStorage nem sessionStorage sem "Lembrar"', async ({
    app: page,
  }) => {
    await configurarChaves(page, { OpenAI: CHAVE_OPENAI, 'Google Gemini': CHAVE_GEMINI });
    // Mexe no formulário para o rascunho ser gravado na sessão.
    await page.getByLabel('Organização').fill('Instituto Horizonte');
    await expect
      .poll(async () => (await conteudoDosStorages(page)).sessao.length)
      .toBeGreaterThan(0);

    const { local, sessao } = await conteudoDosStorages(page);
    expect(local).toEqual([]);
    for (const chave of [CHAVE_OPENAI, CHAVE_GEMINI]) {
      expect(sessao.join('\n')).not.toContain(chave);
      expect(page.url()).not.toContain(chave);
    }
    await page.getByRole('button', { name: 'Configurar chaves de IA' }).click();
    await expect(page.getByRole('checkbox', { name: 'Lembrar neste navegador' })).not.toBeChecked();
    await page.getByRole('button', { name: 'Concluir' }).click();

    // Recarregar descarta as chaves: o cabeçalho volta ao estado sem chave.
    await page.reload();
    await expect(
      page.getByRole('banner').getByRole('button', { name: 'Configurar chaves de IA' }),
    ).toBeVisible();
    await expect(page.getByRole('banner').getByRole('button', { name: /^IA: / })).toHaveCount(0);
    expect((await conteudoDosStorages(page)).local).toEqual([]);
  });
});
