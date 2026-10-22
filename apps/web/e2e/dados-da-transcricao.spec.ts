import { afirmarLimpo, campo, expect, semRolagemHorizontal, test } from './apoio';
import { DURACAO_VTT_MIN, FALANTES_VTT, VTT_REUNIAO } from './fixtures/vtt';

/**
 * Participantes e término a partir da transcrição: tudo acontece neste navegador (nenhuma chamada
 * a provedor, nenhum arquivo novo pedido ao app) e nada é preenchido sem o clique da pessoa.
 */
test.describe('dados tirados da transcrição', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('.vtt com 3 falantes → sugestão → adiciona ao bloco 3; início → sugere e preenche o término', async ({
    app: page,
    rede,
  }) => {
    const arquivosAntes = rede.arquivosDoApp.length;
    const bloco3 = page.getByRole('region', { name: 'Participantes' });
    const bloco4 = page.getByRole('region', { name: 'Transcrição' });
    const bloco2 = page.getByRole('region', { name: 'Dados da reunião' });

    await page.getByLabel('Arquivo de transcrição').setInputFiles({
      name: 'reuniao-de-obra.vtt',
      mimeType: 'text/vtt',
      buffer: Buffer.from(VTT_REUNIAO, 'utf8'),
    });
    await expect(campo(page, 'Transcrição da reunião')).toHaveValue(/^Marina Teles: Bom dia/);

    // Bloco 4: a sugestão (o "MARINA TELES" em maiúsculas é a mesma pessoa).
    await expect(
      bloco4.getByText(
        `Encontramos 3 pessoas que falaram: ${FALANTES_VTT[0]}, ${FALANTES_VTT[1]} e ${FALANTES_VTT[2]}.`,
      ),
    ).toBeVisible();
    await expect(
      bloco4.getByText(
        'Quem participou sem falar não aparece na transcrição — inclua à mão no bloco 3.',
      ),
    ).toBeVisible();
    await semRolagemHorizontal(page);

    // Nada foi preenchido sozinho.
    await expect(bloco3.getByText('0 participantes · 0 presentes')).toBeVisible();
    await expect(campo(page, 'Término')).toHaveValue('');

    // Pelo teclado: foco no botão e Enter; alvo de toque de pelo menos 44 px.
    const adicionar = bloco4.getByRole('button', { name: 'Adicionar como participantes' });
    const caixa = await adicionar.boundingBox();
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
    await adicionar.focus();
    await page.keyboard.press('Enter');

    await expect(
      page
        .getByRole('region', { name: 'Notificações' })
        .getByText('3 participantes adicionados ao bloco 3.'),
    ).toBeVisible();
    await expect(bloco3.getByText('3 participantes · 3 presentes')).toBeVisible();
    for (const [i, nome] of FALANTES_VTT.entries()) {
      await expect(bloco3.getByLabel(`Nome do participante ${String(i + 1)}`)).toHaveValue(nome);
    }
    await expect(bloco4.getByText('Todos os que falaram já estão na lista.')).toBeVisible();
    await expect(bloco4.getByRole('button', { name: /^Adicionar como/ })).toHaveCount(0);

    // Bloco 2: só a duração (o .vtt não traz a hora de início).
    await expect(
      bloco2.getByText(
        `A transcrição dura ${String(DURACAO_VTT_MIN)} min — preencha o início para sugerirmos o término.`,
      ),
    ).toBeVisible();
    await campo(page, 'Início').fill('14:00');
    await expect(
      bloco2.getByText(`A transcrição dura ${String(DURACAO_VTT_MIN)} min.`),
    ).toBeVisible();
    await semRolagemHorizontal(page);
    await bloco2.getByRole('button', { name: 'Preencher o término com 14h42' }).click();
    await expect(campo(page, 'Término')).toHaveValue('14:42');
    await expect(
      bloco2.getByText(
        'Término preenchido com 14h42 (início 14h + 42 min da transcrição). Ajuste se a reunião terminou em outro horário.',
      ),
    ).toBeVisible();

    // Nenhuma chamada a provedor e nenhum arquivo novo do app: tudo foi local.
    expect(rede.chamadas).toEqual([]);
    expect(rede.arquivosDoApp.slice(arquivosAntes)).toEqual([]);
    await afirmarLimpo(page, rede);
  });
});
