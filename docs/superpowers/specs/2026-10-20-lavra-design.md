# Lavra — documento de design

Data: 2026-10-20 · Status: aprovado · Repositório: `lavra-ata` (público, MIT)

> Convenção: **[decisão do autor]** = decidido pelo dono do projeto na conversa de design. **[decisão do Claude]** = escolha feita por quem escreveu este documento; pode ser revista na leitura. Sem marcação = consequência direta das anteriores ou da pesquisa.

---

## 1. Intenção e porquê

Lavra ("lavrar a ata") é um gerador de **ata de reunião** a partir de transcrição. A pessoa abre a página, escolhe o tipo de ata, preenche os dados da reunião, cola a transcrição, sobe a logo e baixa o documento pronto em PDF ou DOCX.

É um projeto **open source de vitrine** do autor (Diego Antunes) para o LinkedIn: precisa impressionar em 30 segundos, estar **terminado** e ser **auditável**. Projeto pequeno e terminado vale mais que grande e abandonado.

Diferenciais (o que o separa de "mais um resumo de reunião"):

1. **Atas formais brasileiras** com estrutura própria por tipo (CIPA/NR-5, condomínio/Código Civil, sócios de Ltda/CC + DREI), além da reunião corporativa.
2. **Privacidade como controle técnico**: identificadores pessoais brasileiros (CPF, CNPJ, telefone, e-mail etc.) são trocados por marcadores **antes** de qualquer envio à IA e reidratados no documento final. Isso vive numa **biblioteca separada e reutilizável** (`packages/pii-br`), da qual o app é consumidor.
3. **BYOK em site 100% estático**: a chave de API é da pessoa, fica no navegador, e as chamadas vão direto ao provedor. Isso é **verificável** (CSP + instruções de DevTools + código aberto).

## 2. Público e critério de sucesso

- **Persona principal [decisão do autor]:** profissional corporativo (consultor, gestor de projeto ou de time), no computador, logo depois de uma call (Teams/Meet/Zoom), com a transcrição exportada na mão. CIPA, condomínio e Ltda são a "prova de profundidade".
- **Quem chega pelo post não tem chave.** Por isso existe o **modo exemplo** (seção 7.7), que mostra o resultado completo sem chave nenhuma.
- **Sucesso:** (a) um visitante do LinkedIn vê uma ata profissional com logo e baixa o PDF em menos de 30 s sem chave; (b) quem tem chave gera a ata da própria reunião em poucos minutos; (c) um dev que abre o repositório consegue verificar a promessa de privacidade sozinho; (d) o repo tem README forte, testes verdes e demo publicada.

## 3. Objetivos, não-objetivos, anti-objetivos

**Objetivos (MVP)**

- 4 tipos de ata: corporativa, CIPA, condomínio, sócios (Ltda). **Sem prazo [decisão do autor]: qualidade antes de data** — os 4 tipos entram, Ltda é o último marco.
- Entrada de transcrição por colar texto ou enviar `.txt` / `.vtt`.
- Proteção de dados pessoais com prévia "o que vai para a IA".
- Geração via OpenAI, Gemini ou Anthropic com as chaves da pessoa, com **ordem de preferência e fallback automático** entre elas.
- Revisão por seção: editar, regerar, ajustar com instrução.
- Exportação PDF e DOCX com logo.
- "Copiar tarefas por responsável" (texto para WhatsApp/e-mail) **[decisão do autor]**.
- Modo exemplo sem chave.
- Página "Privacidade: como verificar".
- Deploy no GitHub Pages; README em português (versão em inglês depois).

**Não-objetivos (fora do MVP, vão para o roadmap do README)**

- Contratos ou outros documentos não-ata **[decisão do autor]** — a arquitetura de "registro de tipos" deixa isso como módulo futuro.
- Assembleia de S.A. e reunião de conselho de administração **[decisão do autor]** (exigem publicação, livro de presença e qualificação completa — alto risco jurídico).
- Transcrição de áudio.
- Histórico/lista de atas salvas, contas, login, backend de qualquer tipo.
- Provedores além de OpenAI, Gemini e Anthropic; interface em inglês; publicação da biblioteca no npm.

**Anti-objetivos (se acontecer, falhou mesmo que "funcione")**

- Qualquer byte de transcrição ou chave indo para um servidor que não seja o provedor escolhido pela pessoa.
- Prometer "anonimização": **nomes de pessoas não são removidos** (a ata precisa deles) e a página diz isso com todas as letras **[decisão do autor, R1]**.
- A IA declarar aprovação, quórum ou unanimidade que não está explícita na transcrição **[decisão do autor, R2]**.
- Ata formal sair sem o aviso de minuta.
- Qualquer menção a clientes, empresas ou produtos de terceiros no código, commits, README ou issues.
- Código, prompts ou templates copiados de outro sistema: **tudo é escrito do zero**.

## 4. Restrições

- **Sem backend.** Site estático. Nenhum proxy, nenhuma função serverless, nenhum analytics, nenhum script/fonte/CSS de terceiros em tempo de execução (fontes auto-hospedadas no bundle).
- **Interface em português do Brasil com acentuação correta.**
- **Licença MIT** **[decisão do Claude, aceita pelo autor]**.
- **Rodapé do site:** "Feito por Diego Antunes" com link para https://www.linkedin.com/in/diego-ozorio-antunes/ **[decisão do autor]** (URL em constante única de configuração, não espalhada).
- Pesquisar a documentação atual de cada lib/SDK antes de usar (a pesquisa de 20/10/2026 está resumida na seção 11).

## 5. Arquitetura

### 5.1 Monorepo [decisão do Claude, aceita pelo autor]

```
lavra-ata/
├─ apps/web/            # o app (Vite + React + TypeScript)
├─ packages/pii-br/     # biblioteca de dados pessoais brasileiros (TS, zero dependências)
├─ docs/                # specs, notas de privacidade
├─ .github/             # workflows de CI e deploy, dependabot, codeql
├─ pnpm-workspace.yaml
├─ LICENSE · README.md · SECURITY.md
```

- Gerenciador: pnpm workspaces. Testes: Vitest. Lint/format: o construtor escolhe (ESLint + Prettier ou Biome), desde que roda no CI.
- `apps/web` depende de `pii-br` via `workspace:*`.

### 5.2 Fluxo de dados (o coração do design)

```
formulário (dados, participantes)  ──────────────────────────────┐
                                                                  ▼
transcrição ──► pii-br.mask() ──► texto mascarado ──► prompt ──► provedor IA (fetch direto)
                     │                                                │
                     └── mapa marcador→original (só em memória)       ▼
                                                     JSON validado por schema
                                                                  │
                         pii-br.validateOutput() ◄────────────────┘
                                   │
                         pii-br.unmask() ──► modelo do documento ──► prévia HTML / PDF / DOCX
```

Princípio: **a IA só escreve o que só a transcrição sabe.** Cabeçalho, título formal, lista de presença, tabela de participantes, blocos de assinatura, fórmula de encerramento e aviso de minuta vêm do **formulário + template**, nunca da IA. Consequências:

- Identificadores do formulário (CNPJ da empresa, quotas, unidades) **nem vão para a IA**.
- A IA não consegue "inventar" presença, mesa ou data.
- O que a IA devolve é narrativa + itens estruturados (deliberações, encaminhamentos, pendências).

### 5.3 Registro de tipos de documento

Cada tipo de ata é um módulo declarativo com:

- `id`, rótulo, descrição curta, ícone;
- **schema do formulário** (campos, obrigatoriedade, máscaras, campos extras de participante);
- **seções** que a IA preenche (chave, título, instrução específica, se é narrativa ou lista);
- **schema JSON da saída** da IA (derivado das seções);
- **regras específicas do prompt** (ex.: CIPA → consenso/votação conforme registrado);
- **template do documento** (título formal, preâmbulo, ordem das seções, fecho, assinaturas, aviso).

Adicionar um tipo (ou, no futuro, contratos) = adicionar um módulo, sem mexer no núcleo.

## 6. Biblioteca `packages/pii-br`

Nome do pacote: `@lavra/pii-br` **[decisão do Claude]** (só no workspace; npm fica fora do MVP). TypeScript, **zero dependências**, ESM, funciona em navegador e Node.

### 6.1 API (formato livre para o construtor, mas com estas capacidades)

- `detect(text, options?)` → lista de achados `{ type, value, start, end, valid }`.
- `mask(text, options?)` → `{ masked, map }`; marcadores no formato `[CPF_1]`, `[TELEFONE_2]` etc. **O mesmo valor recebe sempre o mesmo marcador** dentro de uma sessão (normalizar antes de comparar: CPF com e sem pontuação é o mesmo CPF). O mapa pode ser reaproveitado entre chamadas (regerar/ajustar usam o mesmo mapa).
- `unmask(text, map)` → texto reidratado.
- `validateOutput(output, map, sentInput)` → relatório com: marcadores desconhecidos (que não estão no mapa — IA inventou), marcadores alterados/quebrados (ex.: `[CPF 1]`, `CPF_1`), e **identificadores novos** detectados na saída que não existiam na entrada (IA inventou um CPF/telefone). `sentInput` é o texto **mascarado** exatamente como enviado ao modelo (não o original: com o original, um CPF cru vazado na saída pareceria já presente na entrada).
- `findMarkers(text)` → marcadores dos 9 tipos no texto (tipo, número, trecho, posições), na mesma forma tolerante do `unmask`; serve à prévia de privacidade da app.
- Opções: quais tipos detectar. A opção "exigir DV válido ou aceitar formato" foi substituída pela regra de aceitação da privacidade primeiro (ver decisão 11 da seção 14).

### 6.2 Detectores do MVP

| Tipo              | Regra                                                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPF               | 11 dígitos com/sem máscara, **DV validado**                                                                                                                                                  |
| CNPJ              | numérico e **alfanumérico** (vigente desde jul/2026: 12 posições `[0-9A-Z]` + 2 DV; valor de cada caractere = ASCII − 48; pesos 5..2,9..2 e 6..2,9..2; mod 11), com/sem máscara, DV validado |
| E-mail            | regex pragmática                                                                                                                                                                             |
| Telefone          | fixo e celular BR, com/sem +55, DDD, parênteses, hífen, espaços                                                                                                                              |
| CEP               | `00000-000` / `00000000` (só com hífen ou contexto "CEP", para evitar falso positivo com números quaisquer)                                                                                  |
| Placa             | antiga `AAA-9999`/`AAA9999` e Mercosul `AAA9A99`                                                                                                                                             |
| PIS/PASEP/NIT     | 11 dígitos com DV validado (pesos 3,2,9,8,7,6,5,4,3,2)                                                                                                                                       |
| RG                | **só com contexto** ("RG", "identidade") — não há padrão nacional; sem DV                                                                                                                    |
| Cartão de crédito | 13–19 dígitos com Luhn **[decisão do Claude]**                                                                                                                                               |

Ordem de precedência para sobreposição (ex.: número que casa com CPF e com PIS) é decisão do construtor, documentada e testada.

**Fora:** nomes de pessoas, endereços completos, datas de nascimento. O README da biblioteca diz isso explicitamente.

### 6.3 Testes

Corpus de casos positivos e negativos por detector (incluindo falsos positivos clássicos: números de processo, valores monetários, horários, datas); propriedade "mask → unmask = original"; idempotência do mapa; validação de saída com marcadores inventados. Cobertura alta nessa lib (é a vitrine técnica).

## 7. App `apps/web`

### 7.1 Mapa de uso

1. **Persona/objetivo:** profissional que quer a ata formal da reunião que acabou de acontecer, sem redigir.
2. **Entrada:** a página inicial **é** a bancada (sem landing separada). No topo: `Ver exemplo` · `Privacidade: como verificar` · `Configurar chave de IA` · `GitHub ↗`.
3. **Caminho:** tipo de ata → dados da reunião → participantes → transcrição (com prévia de privacidade) → Gerar → revisar/editar na folha → baixar PDF/DOCX ou copiar tarefas.
4. **Saídas:** Gerar → a folha se preenche e um aviso diz quantos `[PREENCHER]` faltam. Baixar → se houver `[PREENCHER]`, um modal (não `window.confirm`) avisa e permite baixar mesmo assim ou ir até o primeiro. Copiar tarefas → toast "Tarefas de N pessoas copiadas". "Nova ata" → confirmação, limpa tudo.
5. **Estados:** gerando (progresso indeterminado + texto "pode levar até 1–2 minutos" + Cancelar via AbortController); erro do provedor com causa + ação (seção 8.4); sucesso.
6. **Permissão:** não há usuários. A única "permissão" é ter chave: sem chave, tudo funciona exceto Gerar/Regerar/Ajustar, que abrem o modal de chave.

### 7.2 Layout — "Bancada com prévia ao vivo" [decisão do autor]

- **Desktop:** coluna esquerda com 4 blocos recolhíveis numerados (Tipo e logo · Dados da reunião · Participantes · Transcrição), cada um com ✓ ou "falta: X". Abaixo, o botão **Gerar ata** com o resumo do que falta e para qual provedor/modelo vai. Coluna direita: **folha A4** renderizada em HTML, atualizando ao vivo com cabeçalho, logo, participantes e pauta mesmo antes de gerar; botões Baixar PDF / Baixar DOCX / Copiar tarefas por responsável.
- **Celular:** duas abas, "Editar" e "Documento". Sem overflow horizontal a 360 px.
- **Depois de gerar:** cada seção na folha tem as ações **Editar** (edição de texto simples em lugar), **Regerar** (só aquela seção) e **Ajustar com instrução** (campo de até ~1000 caracteres). Regerar e Ajustar partem do **texto atual da seção**, incluindo edições manuais — o trabalho da pessoa nunca é descartado. Regerar tudo pede confirmação se já houver conteúdo.
- `[PREENCHER: …]` aparece destacado na folha (e clicável para editar).
- Mockups aprovados: `.superpowers/brainstorm/` (não versionado).

### 7.3 Identidade visual — "Cartório moderno" [decisão do autor]

- Papel creme, tinta azul-petróleo (primária), terracota (destaque/atenção), grafite (texto). Título serifado, interface sans. Modo escuro incluído.
- Cores como tokens CSS (claro/escuro), contraste WCAG AA verificado. Fontes auto-hospedadas (pacotes de fonte no bundle).
- Valores exatos de cor e fonte ficam com o construtor, partindo dos mockups (azul `#1d4e5f`, terracota `#b5643c`, creme `#f6f1e7`, grafite `#1f2a37` como ponto de partida).
- **A folha A4 é sóbria e neutra**: leva a logo de quem usa e uma cor de destaque opcional escolhida pela pessoa (padrão: grafite). A identidade do Lavra não aparece no documento.

### 7.4 Tipos de ata — conteúdo

Comum a todos: cabeçalho (logo, título, organização, data, hora de início e fim, modalidade presencial/remota/híbrida, local ou plataforma), participantes com presença (presente / ausente / ausência justificada + justificativa), pauta (um item por linha), seções geradas, encaminhamentos (ação, responsável, prazo, status — responsável sem clareza = "A definir"; prazo é data quando claro, senão texto livre), pendências, fecho, assinaturas, aviso de minuta, rodapé "Página X de Y".

Formatação brasileira: datas no corpo formal por extenso ("Aos catorze dias do mês de outubro de dois mil e vinte e seis") e na tabela `dd/mm/aaaa`; horários `14h30`. **Datas nunca passam por `Date` com fuso** — formatar a partir da string `AAAA-MM-DD` (armadilha conhecida: dia −1 no fuso de Brasília).

**a) Reunião corporativa**

- Campos: organização*, título/assunto*, data*, início*, fim, modalidade*, local/plataforma, condução, redator; participantes: nome*, cargo/empresa, presença*.
- Seções da IA: resumo; discussão por item de pauta; decisões; encaminhamentos; pendências (inclui acompanhamento de pendências anteriores, se mencionadas); riscos (opcional, vazio se não houver); próxima reunião (se mencionada).
- Fecho simples; assinaturas opcionais (condução e redator).

**b) CIPA — reunião ordinária/extraordinária (NR-5, Portaria MTP 422/2021)**

- Campos: empresa*, estabelecimento, gestão/mandato*, número da reunião, natureza* (ordinária / extraordinária — se extraordinária, motivo: acidente grave ou fatal, ou solicitação de representação, item 5.6.4), data*, horário*, local*, modalidade*, presidente*, secretário designado* (5.6.5); participantes: nome*, representação* (organização/empregados), condição* (titular/suplente), presença* + justificativa.
- Seções da IA: abertura; leitura/aprovação da ata anterior (se houve); acompanhamento de pendências anteriores; discussão por item de pauta (acidentes, riscos, inspeções, assédio etc. conforme a conversa); deliberações — **registrar se foi por consenso ou votação conforme dito; sem consenso explícito, `[PREENCHER: forma de deliberação]`** (5.6.8); encaminhamentos; encerramento.
- Assinaturas: **todos os presentes** (5.6.3). Nota no rodapé da ata: disponibilizar aos membros e divulgar deliberações aos empregados (5.6.3.1/5.6.3.2) **[decisão do Claude]**.
- Ata de eleição/posse **não** é coberta (documento diferente).

**c) Condomínio — assembleia geral ordinária/extraordinária (CC arts. 1.347–1.356; Lei 4.591/64)**

- Campos: condomínio*, CNPJ, endereço*, natureza* (AGO/AGE), convocação (data do edital, 1ª ou 2ª convocação, horário), data*, horário*, local ou plataforma*, modalidade* (presencial/eletrônica/híbrida — art. 1.354-A), presidente da mesa*, secretário*; participantes: nome*, unidade*, condição* (proprietário/procurador/locatário), fração ideal (opcional), presença.
- Seções da IA: abertura e instalação (registra o quórum **declarado** na reunião; nunca calcula); eleição da mesa (se ocorreu); para cada item da ordem do dia: discussão + **resultado da votação como declarado** (a favor/contra/abstenções se ditos; senão `[PREENCHER: resultado da votação]`); encaminhamentos; encerramento.
- Fecho formal com lavratura, leitura e aprovação. Assinaturas: presidente e secretário (+ campo opcional "assinaturas dos presentes" conforme convenção).
- **O app nunca calcula quórum nem fração ideal**, nem declara validade de deliberação.

**d) Sócios de Ltda — reunião ou assembleia (CC arts. 1.071–1.080-A; Manual DREI de Ltda)** — último marco

- Campos: razão social*, CNPJ*, NIRE, sede*, forma* (reunião/assembleia), data*, horário*, local*, modalidade* (presencial/digital/semipresencial), convocação* (dispensada pela presença de todos / dispensada por ciência escrita / edital publicado — com datas e veículo), presidente*, secretário*; sócios: nome*, participação no capital (% ou quotas)*, presença, representado por procurador (nome).
- O app pode **somar** as participações dos presentes informadas no formulário e mostrar "capital presente informado: X%" (aritmética sobre dado do usuário). **Não** declara se o quórum foi atingido.
- Seções da IA: deliberações por item da ordem do dia, com votos **como declarados** (inclusive dissidências e abstenções); encaminhamentos; encerramento.
- Template: título, nome empresarial, CNPJ/NIRE, preâmbulo com hora/dia/mês/ano/local, mesa, declaração de formalidades de convocação (conforme o campo escolhido), ordem do dia, deliberações, fecho com encerramento/lavratura/leitura/aprovação, assinaturas da mesa e dos sócios. Se digital/semipresencial: parágrafo sobre formato e forma de participação/votação a distância (art. 1.080-A, DREI).
- Aviso reforçado: arquivamento na Junta Comercial em até 20 dias (art. 1.075 §2º) e conferência por profissional.

**Base legal rastreável [decisão do autor: não haverá revisor jurídico].** Todo texto formal fixo (preâmbulo, declarações, fecho, avisos) é redigido a partir dos artigos citados e registrado em `docs/base-legal.md` com: trecho do template → artigo/item da norma → link da fonte oficial (planalto.gov.br, gov.br/DREI, NR-5). O README declara: "Os modelos foram redigidos com base na legislação citada, sem revisão de profissional da área. Contribuições de advogados e técnicos de segurança são bem-vindas." Isso transforma a ausência de revisor em transparência e convite à contribuição.

**Aviso de minuta (todos os tipos, no documento):** "Minuta elaborada com auxílio de inteligência artificial a partir de transcrição. Revise integralmente antes de assinar. Não substitui assessoria jurídica; a validade depende de convocação, quórum e assinaturas, que não foram verificados." (texto final fica com o construtor, mantendo o sentido).

### 7.5 Contrato com a IA

Instruções **escritas do zero** para este projeto, compostas de regras comuns + regras do tipo + tom:

- Português do Brasil, acentuação correta, voz impessoal, registro formal.
- **Não inventar.** Decisão só se explícita; na dúvida, vai para "discussão". Aprovação, unanimidade, contagem de votos e quórum **só se ditos**. Lacuna → `[PREENCHER: o que falta]`.
- Responsável sem clareza → "A definir". Prazo: data `AAAA-MM-DD` quando clara; senão texto ("próxima reunião").
- Nomes exatamente como aparecem.
- **Marcadores `[TIPO_N]` preservados literalmente**, nunca reescritos nem "corrigidos".
- Nada de títulos (vêm do template); nada de HTML/Markdown.
- Saída: **JSON validado por JSON Schema estrito** do tipo de ata. Seções narrativas = lista de blocos `{ tipo: "paragrafo" | "lista", ... }` com texto puro. Itens de encaminhamento = objetos tipados.
- **Tom [decisão do Claude]:** formal (padrão), conciso (~metade), detalhado (~dobro, sem inventar fatos). O tom vale também para Regerar e Ajustar.
- A mensagem do usuário leva: metadados não sensíveis (tipo, natureza, data, pauta, lista de participantes com papel e presença — nomes sim, identificadores não), tom, e a transcrição mascarada.
- **Ajustar com instrução** também mascara a instrução e o texto atual da seção antes de enviar (a pessoa pode ter digitado um CPF ao editar), reaproveitando o mesmo mapa.

### 7.6 Entrada da transcrição

- Colar texto, ou enviar `.txt` / `.vtt` (Teams, Meet e Zoom exportam WebVTT com o nome de quem fala). O `.vtt` é convertido para "Nome: fala" sem timestamps.
- Limite de tamanho com contador (verde → amarelo a 90% → vermelho), mensagem clara se exceder. Valor exato fica com o construtor, dimensionado pelo contexto dos modelos padrão (reunião de 2 h ≈ 25–35 mil palavras).
- **Prévia de privacidade:** selo "🛡 N dados pessoais serão protegidos (2 CPF, 3 telefones…)" + botão que abre o lado a lado "original × o que vai para a IA", com os marcadores destacados. Texto fixo: "Nomes de pessoas não são removidos — a ata precisa deles."
- Funciona **sem chave** (roda 100% local) — é o "uau" do GIF.

### 7.7 Modo exemplo

- Botão `Ver exemplo` (com escolha do tipo) preenche formulário, participantes, transcrição fictícia **e** resultado já gerado (JSON fixo no bundle). Nenhuma chamada de rede.
- Conteúdo fictício escrito do zero: empresas e pessoas inventadas, CPFs/telefones fictícios com formato válido (para a prévia de privacidade ter o que mostrar).
- Banner "Você está vendo um exemplo — nada foi enviado para IA" + `Começar a minha` (limpa tudo).
- Um exemplo para **cada um dos 4 tipos** (sem prazo, não há motivo para cortar).

### 7.8 Exportação

- **Modelo de documento único** (estrutura tipada: cabeçalho, blocos, tabelas, assinaturas) → três renderizadores: prévia HTML (React), **PDF (pdfmake)** e **DOCX (docx)**. Testes de unidade sobre o modelo; teste de fumaça que gera PDF e DOCX do exemplo e confere que não lançam erro e contêm textos-chave.
- PDF: A4, margens confortáveis, logo no cabeçalho (altura máxima fixa, proporção mantida), título centralizado, "Página X de Y" no rodapé, quebra de página que não separa título de seção do conteúdo, tabelas de participantes e encaminhamentos, blocos de assinatura com linha e nome, aviso de minuta, fonte com acentuação (serifada no título, sans no corpo — escolha do construtor, auto-hospedada). pdfmake carregado sob demanda (import dinâmico) por causa do tamanho (~760 KB gzip com fontes).
- DOCX: mesmo conteúdo, editável no Word/LibreOffice, logo como imagem, rodapé com número de página.
- Nome do arquivo: `ata-<tipo>-<aaaa-mm-dd>.pdf|docx`.
- **Logo:** PNG, JPEG, SVG ou WebP até 2 MB; tudo é convertido para PNG via canvas antes de entrar no documento (SVG nunca é inserido como markup). Prévia, botão remover. "Lembrar logo neste navegador" opcional.
- **Copiar tarefas por responsável [decisão do autor]:** agrupa encaminhamentos por responsável ("A definir" por último), formata texto simples com título da reunião, data, cada pessoa com suas ações e prazos; copia para a área de transferência; toast com contagem.

### 7.9 Persistência [decisão do Claude, aceita pelo autor]

- Rascunho (formulário, transcrição, resultado, mapa de marcadores) em `sessionStorage`: sobrevive a F5 acidental, some ao fechar a aba.
- Transcrição e resultado **nunca** em `localStorage`.
- Chave de API: em memória por padrão. Opção "Lembrar neste navegador" (`localStorage`) desmarcada por padrão, com aviso do risco. Botão "Apagar chave" sempre visível quando há chave salva.
- Logo e preferências (tipo, tom, provedor, modelo): `localStorage` opcional.
- Não há lista de atas: o arquivo baixado é o registro. Por isso não há filtros/paginação no app.

### 7.10 Acessibilidade e qualidade de UI

WCAG 2.2 AA; navegação completa por teclado; foco visível; `<label>` em todo campo; `aria-label` em botões só-ícone; modais com focus trap, Esc e retorno de foco; status = cor + ícone + texto; mensagens de erro com causa + ação, embaixo do campo, no blur; máscaras em CNPJ/CPF/telefone/data; botão de gerar desabilitado com spinner durante a chamada; nenhum `window.confirm`. Conferir em 1440, ~1000 e 360 px sem overflow.

## 8. Provedores de IA (BYOK)

### 8.1 Escopo

**Três provedores: OpenAI, Gemini e Anthropic (Claude)**, via **`fetch` direto, sem SDK** [decisão do Claude, aceita pelo autor] — menos dependências, código auditável e uma requisição visível no DevTools por tentativa. Anthropic entra **[decisão do Claude]** porque é o único dos três que **documenta oficialmente** chamada direta do navegador (header `anthropic-dangerous-direct-browser-access: true`) — reduz o risco de CORS da seção 11. Ids de modelo e formato de saída estruturada a confirmar na doc atual.

### 8.1.1 Várias chaves e redundância [decisão do autor]

- A pessoa pode cadastrar **uma chave por provedor** (zero a três) e definir a **ordem de preferência** (arrastar ou setas, com teclado).
- **Cadeia de fallback sequencial** (nunca paralela — custo): se o provedor 1 falhar por 429, 5xx, rede/CORS, corte por tamanho, JSON inválido ou recusa, tenta o próximo da lista com **o mesmo payload já mascarado**. 401/403 também passa para o próximo, mas marca a chave como inválida no modal. Cancelamento pela pessoa interrompe a cadeia.
- **Transparência:** a seção gerada mostra "Gerado por Gemini · gemini-3.8-flash" e, se houve fallback, "OpenAI falhou (limite de uso) — usamos Gemini". Nada de troca silenciosa.
- Regerar/Ajustar seguem a mesma cadeia. Uma ata pode, portanto, ter seções de provedores diferentes — o rodapé interno da folha (não o PDF) lista quais foram usados.
- O modal de chave mostra cada provedor com estado (não configurado / testada ✓ / inválida ✕), link "onde conseguir a chave", botão Testar e Apagar.
- O "como verificar" e a CSP listam só os domínios dos três provedores.

### 8.2 Adaptador comum

Interface única (`gerar(prompt, schema, opções, abortSignal)` → JSON validado | erro tipado). Cada provedor implementa:

- **OpenAI:** Responses API (`POST /v1/responses`) com `text.format` `json_schema` `strict: true` (todo objeto com `additionalProperties: false` e todas as propriedades em `required`). Tratar item de recusa antes do parse. Truncamento: `status: "incomplete"` + `incomplete_details.reason: "max_output_tokens"`.
- **Gemini:** endpoint e formato de schema **a confirmar com chamada real** (a doc de out/2026 marca `generateContent` como "legacy" e promove a Interactions API; os nomes do campo de schema estão conflitantes). Header `x-goog-api-key`, nunca `?key=`. Truncamento: `finishReason: "MAX_TOKENS"` ou `status: "incomplete"`.
- **Orçamento de saída:** o raciocínio/"thinking" consome o mesmo limite de saída nos dois provedores — usar esforço de raciocínio baixo/mínimo e um teto de saída folgado; corte **sempre** vira erro explícito, nunca sucesso parcial.
- **Lista de modelos:** constante única e nomeada por provedor, com um padrão barato (referência de out/2026: `gpt-6-luna`; `gemini-3.8-flash`) + campo "outro modelo" livre. Os modelos mudam rápido; não espalhar ids pelo código.
- **Anthropic:** Messages API (`POST /v1/messages`) com headers `x-api-key`, `anthropic-version` e `anthropic-dangerous-direct-browser-access: true`; saída estruturada pelo mecanismo atual documentado (structured outputs ou tool use com schema). Truncamento: `stop_reason: "max_tokens"`.
- **Testar chave:** chamada barata (ex.: listar modelos) no modal de chave, com resultado claro.

### 8.3 Validação da resposta

JSON parse → validação contra o schema do tipo (validador leve no cliente) → `pii-br.validateOutput` → normalização (trim, responsável vazio → "A definir", status padrão "pendente", itens sem descrição descartados, seção ausente → vazia) → `unmask`. Problemas de `validateOutput` viram aviso visível na seção afetada ("a IA citou um telefone que não estava na transcrição — confira"), não bloqueio.

### 8.4 Erros (mensagem com causa + ação)

401/403 chave inválida ou sem permissão · 429 limite/crédito · 5xx provedor instável (tentar de novo) · corte por tamanho (tentar tom conciso ou modelo maior) · falha de rede/CORS ("o provedor recusou a chamada direta do navegador — veja o status no README") · JSON inválido · cancelado pela pessoa. Retry automático só em 429/5xx, com limite. A chave nunca aparece em mensagem de erro nem no console.

## 9. Segurança

- **CSP via `<meta>`** (GitHub Pages não permite headers): `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src https://api.openai.com https://generativelanguage.googleapis.com https://api.anthropic.com; object-src 'none'; base-uri 'self'; form-action 'none'`. O construtor ajusta o mínimo necessário (ex.: `worker-src`/`frame-src blob:` se a prévia de PDF usar) e **documenta cada exceção**. Sem `unsafe-inline`/`unsafe-eval` em `script-src`.
- Limitação conhecida: `frame-ancestors` não funciona em meta → sem proteção contra clickjacking no Pages. Documentar em `SECURITY.md`.
- **Nenhum HTML vindo da IA é renderizado como HTML.** A saída é JSON com texto puro, renderizado como nó de texto pelo React; nenhum `dangerouslySetInnerHTML` no projeto (regra de lint). Com isso o DOMPurify não é necessário.
- Logo: arquivo validado por tipo/tamanho e rasterizado em canvas.
- Dependências: lockfile, versões fixas, Dependabot, CodeQL, `pnpm audit` no CI; poucas dependências de runtime (React, pdfmake, docx e o mínimo de utilitários).
- Sem analytics, sem service worker de terceiros, sem fontes externas.
- `SECURITY.md` com modelo de ameaças curto: XSS (mitigado por CSP + sem HTML), extensão de navegador maliciosa (fora do controle — recomendar chave com limite de gasto e "lembrar" desligado), conta de provedor (os dados vão para o provedor escolhido, sob os termos dele).

## 10. "Privacidade: como verificar" (página no app + seção do README)

- O que sai do navegador: **somente** requisições aos provedores cadastrados pela pessoa (na ordem dela), com a transcrição já mascarada.
- Passo a passo DevTools: F12 → Rede → recarregar → filtrar por "Fetch/XHR" → gerar → só aparecem `api.openai.com`, `generativelanguage.googleapis.com` ou `api.anthropic.com`; abrir o payload e ver os marcadores no lugar dos dados.
- Ver a CSP: aba Elementos → `<meta http-equiv="Content-Security-Policy">`; o próprio navegador bloqueia qualquer outro destino.
- Link para o código do adaptador de IA e da biblioteca.
- **Versão publicada rastreável:** rodapé mostra o hash do commit que gerou o deploy, com link para o código daquela versão; o deploy é feito pelo GitHub Actions a partir do repositório.
- O que **não** é protegido: nomes de pessoas e qualquer informação sensível em linguagem natural; os dados vão para o provedor sob os termos dele.

## 11. Pesquisa técnica (20/10/2026) — pontos que afetam o plano

- **OpenAI no navegador:** funciona, mas **não é oficialmente suportado**; o CORS já quebrou em out/2025 (Chat Completions) e jan/2026 (Responses), corrigido em seguida.
- **Gemini:** chaves sem restrição passaram a ser rejeitadas e chaves novas do AI Studio são "auth keys" ligadas a service account (mai/2026). **Não verificado** se funcionam via `fetch` do navegador. Google recomenda não expor chave no cliente em produção.
- **Consequência:** o primeiro marco do plano é um **spike de conectividade** (página mínima chamando os três provedores do navegador com chave real, com saída JSON estruturada e CSP ativa). **Quem roda:** o autor, localmente, colando as próprias chaves na página do spike (chaves nunca vão para o repositório, logs ou chat). Provedor sem chave disponível no momento: o adaptador é construído pela documentação e testado com resposta interceptada, e fica marcado como **"não verificado com chamada real"** no plano e no README até o autor testar. Critério: **o MVP é válido com pelo menos um provedor funcionando**; provedor que falhar do navegador fica fora do MVP e o README explica — **sem criar proxy** (violaria "sem backend"). Provedor que funciona hoje mas sem garantia oficial (OpenAI) entra; a cadeia de fallback é justamente a proteção contra uma quebra futura **[decisão do Claude]**.
- Versões de referência (out/2026): Vite 8.3, React 19.3, TypeScript 7.0 (major nova — confirmar compatibilidade de Vite/Vitest/ESLint; se houver atrito, fixar a última 6.x e registrar), Vitest 5.0, pnpm 12, pdfmake 0.3.12, docx 9.13; Actions: checkout v7, setup-node v7, pnpm/action-setup v6, configure-pages v6, upload-pages-artifact v5, deploy-pages v5.
- Regras de DV: CNPJ alfanumérico (Receita/Serpro), PIS (pesos 3,2,9..2), placas antiga/Mercosul — ver seção 6.2.

## 12. Qualidade e entrega

- **Testes:** Vitest em `pii-br` (cobertura alta) e no núcleo do app (montagem de prompt, schema por tipo, normalização, modelo de documento, formatação de datas por extenso, parser de `.vtt`, agrupamento de tarefas). E2E de fumaça (Playwright) no modo exemplo + uma geração com o provedor **interceptado** (resposta fixa), garantindo que nenhuma requisição sai para domínio fora da lista.
- **CI (PR e main):** lint, typecheck, testes (com teto de workers), build, audit.
- **Deploy:** GitHub Actions → GitHub Pages a partir da `main`; `base` do Vite configurado para `/lavra-ata/`.
- **README (pt-BR):** o que é; GIF (exemplo + prévia de privacidade + PDF); link da demo; "Privacidade: como verificar"; tipos de ata e base legal; como rodar (`pnpm i`, `pnpm dev`, `pnpm test`); arquitetura (monorepo, lib); limitações honestas (nomes não mascarados, minuta, CORS da OpenAI); roadmap (contratos, áudio, S.A./conselho, EN, npm); licença MIT; "Feito por Diego Antunes" + LinkedIn. README.en.md depois.
- `.superpowers/` no `.gitignore`.

## 13. Deixado ao construtor

Biblioteca de UI/estilo (CSS próprio com tokens é suficiente; nada de kit pesado), gerenciamento de estado, validador de JSON Schema no cliente, lint/format, estrutura interna de pastas, precedência entre detectores sobrepostos, limite exato de caracteres, texto final dos avisos (mantendo o sentido), tipografia exata, valores de retry/timeout, uso do `.vtt` (agrupar falas consecutivas do mesmo falante etc.).

## 14. Decisões tomadas pelo Claude (revisar na leitura)

1. Nome do pacote `@lavra/pii-br`; cartão de crédito (Luhn) entre os detectores.
2. Tons: formal (padrão), conciso, detalhado — sem os demais.
3. Saída da IA em blocos de texto puro (sem HTML) → sem DOMPurify, sem `dangerouslySetInnerHTML`.
4. Persistência: rascunho em `sessionStorage`; chave em memória por padrão.
5. `docs/base-legal.md` como rastro de cada texto formal até a norma.
6. Nota de divulgação no rodapé da ata de CIPA.
7. "Capital presente informado" somado no tipo Ltda, sem julgar quórum.
8. Spike de conectividade como primeiro marco; sem proxy em caso de falha.
9. Página inicial = a própria bancada (sem landing separada).
10. Anthropic como terceiro provedor (único com chamada do navegador documentada oficialmente); fallback sequencial, nunca paralelo; fallback sempre declarado na tela.
11. `pii-br`: a opção "exigir DV válido ou aceitar formato" foi substituída pela regra de aceitação da privacidade primeiro — mascara se o formato estiver completo **ou** houver palavra de contexto **ou** o DV conferir (CPF, CNPJ e PIS; cartão exige Luhn sempre). Aceita falsos positivos para não vazar.
