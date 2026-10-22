import type { Locator, Page } from '@playwright/test';
import {
  CHAVE_OPENAI,
  CPF,
  CPF_SO_DIGITOS,
  FOLGA_FALLBACK_MS,
  afirmarLimpo,
  baixar,
  campo,
  colarParticipantes,
  comeca,
  configurarChaves,
  escolherTipo,
  expect,
  folha,
  gerarAta,
  preencherCampos,
  preencherReuniao,
  preencherVazios,
  semRolagemHorizontal,
  test,
  textoDoPdf,
  xmlDoDocx,
  type Rede,
} from './apoio';
import { MARCADOR_CPF } from './fixtures/respostas';

/**
 * E2E dos três tipos formais (CIPA, condomínio, sócios de Ltda) e da troca de tipo, contra o build
 * com CSP ativa. Cada cenário passa pela rede auditada de `apoio.ts` e termina em `afirmarLimpo`.
 */

const TIPO_CORPORATIVA = 'Reunião corporativa';
const TIPO_CIPA = 'CIPA — reunião ordinária ou extraordinária';
const TIPO_CONDOMINIO = 'Condomínio — assembleia geral';
const TIPO_LTDA = 'Sócios de Ltda — reunião ou assembleia';

const MOTIVO_IA_OCUPADA = 'Aguarde a geração em andamento terminar.';
const UMA_LACUNA = '1 campo marcado com [PREENCHER] vai sair no documento como está.';
const ABRIR_GERACAO = 'Ata gerada por OpenAI · gpt-6-luna';

const CNPJ_EXEMPLO = '11.222.333/0001-81';

/** O único corpo de requisição de geração que chegou à OpenAI. */
function corpoDaGeracao(rede: Rede): string {
  const geracoes = rede.chamadas.filter((c) => c.metodo === 'POST' && c.provedor === 'openai');
  expect(geracoes).toHaveLength(1);
  return geracoes[0]?.corpo ?? '';
}

function listaDeLinhas(modelo: (i: number) => string, quantos: number): string[] {
  return Array.from({ length: quantos }, (_, i) => modelo(i));
}

/** Uma linha por pessoa que assina: os filhos diretos do grupo de assinaturas. */
function pessoasQueAssinam(grupo: Locator): Locator {
  return grupo.locator(':scope > div');
}

test.describe('CIPA no build com CSP ativa', () => {
  test.use({ cenario: { openai: 'ok', tipo: 'cipa' } });

  test('reunião extraordinária: motivo exigido, assinaturas, aviso da NR-5, PDF e DOCX', async ({
    app: page,
    rede,
  }) => {
    await configurarChaves(page, { OpenAI: CHAVE_OPENAI });
    await escolherTipo(page, TIPO_CIPA);
    await preencherCampos(page, {
      Empresa: 'Empresa Exemplo Ltda.',
      'Gestão (mandato)': '2026/2027',
      'Número da reunião': '3',
      Natureza: 'Extraordinária',
      Data: '2026-10-14',
      Início: '14:00',
      Modalidade: 'Presencial',
      Local: 'Sala de reuniões do almoxarifado',
      Presidente: 'Marcos Ferraz',
      'Secretário(a) designado(a)': 'Joana Prado',
      Pauta: 'Acidente no corredor de carga\nSinalização do piso',
    });
    await colarParticipantes(
      page,
      [
        'Marcos Ferraz — Gerente de produção',
        'Joana Prado — Técnica de segurança',
        'Helena Duarte — Operadora de empilhadeira',
        'Rafael Moura — Almoxarife',
      ],
      '4 participantes adicionados.',
    );
    await page
      .getByLabel('Representação do participante 1', { exact: true })
      .selectOption({ label: 'Representante da organização' });
    await preencherVazios(page, 'Representação', 'Representante dos empregados');
    await page
      .getByLabel('Transcrição da reunião')
      .fill(
        `Marcos Ferraz: Abrimos a reunião por causa do acidente no corredor de carga. O documento do envolvido é o CPF ${CPF}.\nJoana Prado: Precisamos sinalizar o piso.`,
      );

    // Extraordinária sem motivo: a geração fica bloqueada e a barra diz o que falta.
    await expect(
      page.getByText('Falta: Motivo da reunião extraordinária', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Gerar ata/ })).toBeDisabled();

    await preencherCampos(page, {
      'Motivo da reunião extraordinária': 'Acidente do trabalho grave ou fatal',
    });
    await expect(page.getByRole('button', { name: /Gerar ata/ })).toBeEnabled();
    await page.getByRole('button', { name: /Gerar ata/ }).click();
    await expect(page.getByText(ABRIR_GERACAO)).toBeVisible({ timeout: FOLGA_FALLBACK_MS });

    const documento = folha(page);
    await expect(documento).toContainText(
      'Comissão Interna de Prevenção de Acidentes e de Assédio',
    );
    await expect(documento).toContainText(
      'convocada em razão de acidente do trabalho grave ou fatal',
    );
    await expect(documento).toContainText(CPF);
    const assinaturas = documento.getByRole('group', { name: 'Assinaturas', exact: true });
    await expect(pessoasQueAssinam(assinaturas)).toHaveCount(4);
    await expect(assinaturas).toContainText('Representante da organização');
    await expect(assinaturas).toContainText('Representante dos empregados');
    await expect(documento.getByRole('note').filter({ hasText: '5.6.3.2' })).toBeVisible();

    // O que saiu para a IA: representação e marcador do CPF; nunca o CPF.
    const corpo = corpoDaGeracao(rede);
    expect(corpo).toContain('Representante dos empregados');
    expect(corpo).toContain(MARCADOR_CPF);
    expect(corpo).not.toContain(CPF);
    expect(corpo).not.toContain(CPF_SO_DIGITOS);

    // A forma de deliberação não dita vira lacuna e o modal de download a conta.
    const pdf = await baixar(page, 'Baixar PDF', async (modal) => {
      await expect(modal.getByText(UMA_LACUNA, { exact: true })).toBeVisible();
    });
    expect(pdf.nome).toBe('ata-cipa-2026-10-14.pdf');
    expect(comeca(pdf.bytes, '%PDF-')).toBe(true);
    expect((await textoDoPdf(pdf.bytes)).paginas.join(' ')).toContain('5.6.3.2');

    const docx = await baixar(page, 'Baixar DOCX');
    expect(docx.nome).toBe('ata-cipa-2026-10-14.docx');
    expect(xmlDoDocx(docx.bytes)).toContain('Representação');

    await afirmarLimpo(page, rede);
  });
});

test.describe('condomínio no build com CSP ativa', () => {
  test.use({ cenario: { openai: 'ok', tipo: 'condominio' } });

  test('200 condôminos: vínculo em lote, busca por unidade, assinaturas e PDF paginado', async ({
    app: page,
    rede,
  }) => {
    await configurarChaves(page, { OpenAI: CHAVE_OPENAI });
    await escolherTipo(page, TIPO_CONDOMINIO);
    // "Data" e "Data do edital" no mesmo formulário: o rótulo exato não pode ser ambíguo.
    await preencherCampos(page, {
      Condomínio: 'Condomínio Edifício Exemplo',
      Endereço: 'Rua das Acácias, 100',
      Natureza: 'Ordinária (AGO)',
      Data: '2026-10-14',
      'Data do edital': '2026-09-20',
      Início: '19:00',
      Modalidade: 'Presencial',
      Local: 'Salão de festas',
      'Presidente da mesa': 'Marcos Ferraz',
      'Secretário(a)': 'Joana Prado',
      'Ordem do dia': 'Prestação de contas\nReforma da portaria',
    });
    await expect(campo(page, 'Data')).toHaveValue('2026-10-14');
    await expect(campo(page, 'Data do edital')).toHaveValue('2026-09-20');

    await colarParticipantes(
      page,
      listaDeLinhas(
        (i) => `Condômino de volume nº ${String(i + 1).padStart(3, '0')} — Apto ${String(101 + i)}`,
        200,
      ),
      '200 participantes adicionados.',
    );
    await preencherVazios(page, 'Vínculo', 'Proprietário(a)');
    await expect(
      page.getByText('Vínculo “Proprietário(a)” aplicado a 200 participantes sem valor.', {
        exact: true,
      }),
    ).toBeVisible();

    // Busca pela unidade: sobra uma linha.
    const linhas = page.getByRole('region', { name: 'Lista de participantes' }).locator('tbody tr');
    await expect(linhas).toHaveCount(200);
    await page.getByLabel('Buscar participante', { exact: true }).fill('Apto 150');
    await expect(linhas).toHaveCount(1);
    await page.getByLabel('Buscar participante', { exact: true }).fill('');
    await expect(linhas).toHaveCount(200);

    await preencherCampos(page, { 'Quem assina a ata': 'A mesa e os condôminos presentes' });
    await page
      .getByLabel('Transcrição da reunião')
      .fill('Joana Prado: Abrimos a assembleia. A síndica apresentou as contas.');
    await page.getByRole('button', { name: /Gerar ata/ }).click();
    await expect(page.getByText(ABRIR_GERACAO)).toBeVisible({ timeout: FOLGA_FALLBACK_MS });

    const condominos = folha(page).getByRole('group', {
      name: 'Assinaturas — Condôminos presentes',
    });
    await expect(pessoasQueAssinam(condominos)).toHaveCount(200);
    await expect(folha(page).getByRole('group', { name: 'Assinaturas — Mesa' })).toBeVisible();

    // A unidade (e a fração) nunca vão para a IA.
    const corpo = corpoDaGeracao(rede);
    expect(corpo).not.toContain('Apto 1');
    expect(corpo).not.toMatch(/Apto \d/);

    // Votação sem resultado dito: lacuna no modal; o PDF tem várias páginas, todas numeradas, e a
    // tabela de condôminos repete o cabeçalho "Unidade" em cada página.
    const pdf = await baixar(page, 'Baixar PDF', async (modal) => {
      await expect(modal.getByText(UMA_LACUNA, { exact: true })).toBeVisible();
    });
    expect(pdf.nome).toBe('ata-condominio-2026-10-14.pdf');
    const { paginas, total } = await textoDoPdf(pdf.bytes);
    expect(total).toBeGreaterThanOrEqual(5);
    expect(paginas).toHaveLength(total);
    paginas.forEach((pagina, i) => {
      expect(pagina).toContain(`Página ${String(i + 1)} de ${String(total)}`);
    });
    const primeiraDasAssinaturas = paginas.findIndex((p) => p.includes('Condôminos presentes'));
    expect(primeiraDasAssinaturas).toBeGreaterThan(1);
    const daTabela = paginas
      .slice(0, primeiraDasAssinaturas)
      .filter((p) => p.includes('Condômino de volume nº'));
    expect(daTabela.length).toBeGreaterThan(1);
    for (const pagina of daTabela) expect(pagina).toContain('Unidade');
    expect(paginas.join(' ')).toContain('[PREENCHER: resultado da votação]');

    await afirmarLimpo(page, rede);
  });
});

test.describe('sócios de Ltda no build com CSP ativa', () => {
  test.use({ cenario: { openai: 'ok', tipo: 'socios-ltda' } });

  test('capital presente informado, alertas, voto a distância, PDF sem participação enviada à IA', async ({
    app: page,
    rede,
  }) => {
    await configurarChaves(page, { OpenAI: CHAVE_OPENAI });
    await escolherTipo(page, TIPO_LTDA);
    await preencherCampos(page, {
      'Nome empresarial': 'Empresa Exemplo Ltda.',
      CNPJ: CNPJ_EXEMPLO,
      'Endereço da sede': 'Avenida das Palmeiras, 500',
      Forma: 'Reunião de sócios',
      Data: '2026-10-14',
      Início: '10:00',
      Modalidade: 'Presencial',
      Local: 'Sede da sociedade',
      Convocação: 'Na forma do contrato social',
      'Meio e data da convocação': 'Carta registrada enviada em 20/09/2026',
      Presidente: 'Marcos Ferraz',
      'Secretário(a)': 'Joana Prado',
      'Participação informada em': 'Percentual (%)',
      'Declaração de formalidades': 'A mesa declara atendidas as formalidades legais',
      'Ordem do dia': 'Mudança do endereço da sede',
    });
    await colarParticipantes(
      page,
      ['Ana Souza — 50', 'Bruno Lima — 37,5', 'Carla Dias — 12,5'],
      '3 participantes adicionados.',
    );
    // Todos presentes: 100% (anunciado quando a lista muda); a sócia ausente tira 12,5.
    await expect(
      page.getByRole('status').filter({ hasText: 'Capital presente informado: 100%' }),
    ).toHaveCount(1);
    await page
      .getByLabel('Presença de Carla Dias', { exact: true })
      .selectOption({ label: 'Ausente' });
    await expect(
      page.getByText('Capital presente informado: 87,5%', { exact: true }),
    ).toBeVisible();

    await page
      .getByLabel('Transcrição da reunião')
      .fill('Joana Prado: Abrimos a reunião. Marcos Ferraz propôs mudar o endereço da sede.');
    await page.getByRole('button', { name: /Gerar ata/ }).click();
    await expect(page.getByText(ABRIR_GERACAO)).toBeVisible({ timeout: FOLGA_FALLBACK_MS });

    // Nenhuma participação vai para a IA (nem a soma).
    const corpo = corpoDaGeracao(rede);
    expect(corpo).not.toContain('37,5');
    expect(corpo).not.toContain('87,5');
    expect(corpo).not.toContain('12,5');

    const documento = folha(page);
    await expect(documento).toContainText('titulares de 87,5% do capital social');
    await expect(documento).not.toContainText(
      '[PREENCHER: capital social representado pelos presentes]',
    );

    // Soma acima de 100%: alerta e lacuna no documento. Voltando a 50%, tudo some.
    const participacaoDoPrimeiro = page.getByLabel('Participação (%) do participante 1', {
      exact: true,
    });
    await participacaoDoPrimeiro.fill('60');
    await expect(
      page.getByRole('note').filter({ hasText: 'As participações informadas somam 110%' }),
    ).toBeVisible();
    await expect(documento).toContainText(
      '[PREENCHER: capital social representado pelos presentes]',
    );
    await participacaoDoPrimeiro.fill('50');
    await expect(
      page.getByRole('note').filter({ hasText: 'As participações informadas somam' }),
    ).toHaveCount(0);
    await expect(documento).not.toContainText(
      '[PREENCHER: capital social representado pelos presentes]',
    );

    // "Todos presentes" com um ausente: só alerta, não bloqueia.
    await preencherCampos(page, { Convocação: 'Dispensada: todos os sócios presentes' });
    await expect(
      page.getByRole('note').filter({
        hasText:
          'Você indicou que todos os sócios compareceram, mas 1 sócio está marcado como ausente.',
      }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Gerar ata/ })).toBeEnabled();

    // Digital com boletim de voto a distância: o parágrafo cita o art. 1.080-A.
    await preencherCampos(page, {
      Modalidade: 'Digital',
      'Sistema eletrônico': 'plataforma de videoconferência',
      'Participação e voto a distância': 'Boletim de voto a distância',
    });
    await expect(documento).toContainText(
      'com participação e votação a distância mediante boletim de voto a distância',
    );
    await expect(documento).toContainText('art. 1.080-A do Código Civil');

    const pdf = await baixar(page, 'Baixar PDF');
    expect(pdf.nome).toBe('ata-socios-ltda-2026-10-14.pdf');
    const texto = (await textoDoPdf(pdf.bytes)).paginas.join(' ');
    expect(texto).toContain('nos 20 dias seguintes');
    expect(texto).toContain('Sócios presentes');

    await afirmarLimpo(page, rede);
  });
});

test.describe('troca de tipo no build com CSP ativa', () => {
  test.use({ cenario: { openai: 'ok', tipo: 'corporativa' } });

  async function trocarPara(page: Page, rotulo: string): Promise<Locator> {
    await escolherTipo(page, rotulo);
    return page.getByRole('dialog', { name: 'Trocar o tipo de ata?' });
  }

  test('com ata gerada pede confirmação, mantém o que é comum e devolve o que era do tipo anterior', async ({
    app: page,
    rede,
  }) => {
    await gerarAta(page);
    await expect(folha(page).getByRole('heading', { name: 'Decisões' })).toBeVisible();

    // O foco abre em "Manter"; manter não muda nada.
    const dialogo = await trocarPara(page, TIPO_CIPA);
    await expect(dialogo).toBeVisible();
    await expect(
      dialogo.getByRole('button', { name: `Manter “${TIPO_CORPORATIVA}”`, exact: true }),
    ).toBeFocused();
    await dialogo
      .getByRole('button', { name: `Manter “${TIPO_CORPORATIVA}”`, exact: true })
      .click();
    await expect(dialogo).toBeHidden();
    await expect(folha(page).getByRole('heading', { name: 'Decisões' })).toBeVisible();
    await expect(
      page.getByRole('radio', { name: new RegExp(`^${TIPO_CORPORATIVA}`) }),
    ).toBeChecked();

    // Trocar descarta a ata gerada, mantém pauta e participantes e deixa a modalidade em falta.
    const outra = await trocarPara(page, TIPO_CIPA);
    await outra
      .getByRole('button', { name: 'Trocar e descartar a ata gerada', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Notificações' }).getByText('foi descartada'),
    ).toBeVisible();
    const documento = folha(page);
    await expect(documento).toContainText('As seções aparecem aqui depois de gerar a ata.');
    await expect(documento.getByRole('heading', { name: 'Decisões' })).toHaveCount(0);
    await expect(documento.getByRole('table', { name: 'Participantes' })).toContainText(
      'Marcos Ferraz',
    );
    await expect(documento).toContainText('Cronograma do projeto');
    await expect(page.getByText(/^Falta:/)).toContainText('Modalidade');
    await expect(campo(page, 'Modalidade')).toHaveValue('');
    // A plataforma da reunião corporativa remota não vira o local da CIPA.
    await expect(documento).not.toContainText('videoconferência');
    await expect(campo(page, 'Local')).toHaveValue('');

    // De volta à corporativa (sem ata gerada, sem modal): o que era dela reaparece.
    await escolherTipo(page, TIPO_CORPORATIVA);
    await expect(campo(page, 'Organização')).toHaveValue('Instituto Horizonte');
    await expect(campo(page, 'Plataforma')).toHaveValue('videoconferência');

    await afirmarLimpo(page, rede);
  });

  test('durante a geração os rádios de tipo ficam parados com o motivo', async ({
    app: page,
    rede,
  }) => {
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

    const grupo = page.getByRole('group', { name: 'Tipo de ata', exact: true });
    await expect(grupo.getByText(MOTIVO_IA_OCUPADA)).toBeVisible();
    const radios = await grupo.getByRole('radio').all();
    expect(radios).toHaveLength(4);
    for (const radio of radios) await expect(radio).toBeDisabled();

    liberar();
    await expect(page.getByText(ABRIR_GERACAO)).toBeVisible({ timeout: FOLGA_FALLBACK_MS });
    await expect(grupo.getByText(MOTIVO_IA_OCUPADA)).toBeHidden();
    for (const radio of radios) await expect(radio).toBeEnabled();

    await afirmarLimpo(page, rede);
  });
});

test.describe('celular (360×740) no build com CSP ativa', () => {
  test.use({ viewport: { width: 360, height: 740 }, cenario: { openai: 'ok' } });

  /** Cada participante vira um cartão: a tabela deixa de ser `table` e cabe na largura. */
  async function participantesEmCartoes(page: Page) {
    const exibicao = await page
      .getByRole('region', { name: 'Lista de participantes' })
      .locator('tbody tr')
      .first()
      .evaluate((tr) => getComputedStyle(tr).display);
    expect(exibicao).toBe('block');
  }

  test('CIPA: participantes em cartões, sem rolagem horizontal', async ({ app: page, rede }) => {
    await escolherTipo(page, TIPO_CIPA);
    await colarParticipantes(
      page,
      listaDeLinhas(
        (i) =>
          `Participante ${String(i + 1)} de Sobrenome Muito Comprido — Coordenação de Operações`,
        5,
      ),
    );
    await preencherVazios(page, 'Representação', 'Representante dos empregados');
    await participantesEmCartoes(page);
    await semRolagemHorizontal(page);
    await afirmarLimpo(page, rede);
  });

  test('condomínio: participantes em cartões, sem rolagem horizontal', async ({
    app: page,
    rede,
  }) => {
    await escolherTipo(page, TIPO_CONDOMINIO);
    await colarParticipantes(
      page,
      listaDeLinhas(
        (i) =>
          `Condômino de Sobrenome Muito Comprido ${String(i + 1)} — Cobertura Duplex ${String(101 + i)}`,
        5,
      ),
    );
    await preencherVazios(page, 'Vínculo', 'Proprietário(a)');
    await participantesEmCartoes(page);
    await semRolagemHorizontal(page);
    await afirmarLimpo(page, rede);
  });

  test('Ltda: participantes em cartões e resumo do capital, sem rolagem horizontal', async ({
    app: page,
    rede,
  }) => {
    await escolherTipo(page, TIPO_LTDA);
    await colarParticipantes(page, [
      'Sócia de Sobrenome Muito Comprido Primeira — 50',
      'Sócio de Sobrenome Muito Comprido Segundo — 30',
      'Sócia de Sobrenome Muito Comprido Terceira — 20',
    ]);
    // O resumo aparece uma vez para quem enxerga e outra, só para leitor de tela, no `status`.
    await expect(
      page.getByText('Capital presente informado: 100%', { exact: true }).first(),
    ).toBeVisible();
    await participantesEmCartoes(page);
    await semRolagemHorizontal(page);

    // O alerta de soma acima de 100% (texto comprido) também cabe na largura.
    await page.getByLabel('Participação (%) do participante 1', { exact: true }).fill('60');
    await expect(
      page.getByRole('note').filter({ hasText: 'As participações informadas somam 110%' }),
    ).toBeVisible();
    await semRolagemHorizontal(page);
    await afirmarLimpo(page, rede);
  });
});
