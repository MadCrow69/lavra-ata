# Plano 05 — Tipos formais: CIPA, condomínio e sócios de Ltda, com base legal rastreável

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Frontend tasks also follow the `ux-ui-defensive` protocol (gates 1–3); every match of a participant, signature or field is by `id`, never by typed text (skill `texto-nunca-e-chave`).

**Goal:** a pessoa escolhe CIPA, condomínio ou sócios de Ltda, preenche os campos próprios do tipo (participantes com unidade, representação ou participação no capital), gera a ata e baixa PDF/DOCX com preâmbulo, fecho, assinaturas e avisos escritos a partir da norma — cada texto fixo rastreado em `docs/base-legal.md` até artigo/item e link oficial.

**Architecture:** primeiro o registro de tipos (`apps/web/src/ata-types`) fica genérico de verdade nos pontos onde hoje só a corporativa funciona — colunas de participante (form, folha, PDF, DOCX e prompt), validação de formato, complemento ao colar, grupos de assinatura, avisos finais, resumo de participantes e troca de tipo com rascunho preenchido. Depois cada tipo vira um módulo declarativo que só usa esses ganchos; nenhum renderizador ganha `if (tipo === …)`. O app continua sem calcular quórum, fração ideal ou validade: o único número que ele produz é a soma das participações informadas dos sócios presentes (Ltda), mostrada como "capital presente informado".

**Tech Stack:** React 19.3, Vite 8, TypeScript 6.0.3, Vitest 5 + Testing Library + jsdom, Playwright, pdfmake 0.3.11, docx 9.11.0, `fontkit@2.0.4` (já é devDependency; usado só no teste de largura de colunas), `@lavra/pii-br` (`isValidCnpj`). **Nenhuma dependência nova.**

**Spec:** `docs/superpowers/specs/2026-10-20-lavra-design.md` (seções 5.2, 5.3, 7.1, 7.2, 7.4 b/c/d e "Base legal rastreável", 7.5, 7.10, 14) · **Roteiro:** `docs/superpowers/plans/2026-10-20-00-roteiro.md` (linha 05)

**Branch/PR:** `feat/05-tipos-formais` → PR "feat(web): atas de CIPA, condomínio e sócios de Ltda com base legal rastreável".

**Fora deste plano (sinalizado):** modo exemplo dos 4 tipos e a fumaça "PDF/DOCX do exemplo" (Plano 06); ata de eleição/posse da CIPA (spec 7.4 b); sessão permanente e ata parcial do condomínio (CC art. 1.353, § 1º — só registrada pela IA se for dita); documento de decisão de todos os sócios sem reunião e decisão de sócio único (Manual DREI, Seção II); dispensa de reunião para ME/EPP (LC 123/2006, art. 70 — o app não decide se a reunião era exigida); máscara de digitação de CNPJ (só validação); preferências em `localStorage` e cor de destaque (spec 7.3/7.9). **Pendências do Plano 04:** "Nova ata mantém a logo" já é o comportamento aceito — nada a fazer; o **layout do DOCX continua verificado só pelo XML** (o Task 9 tenta abrir no LibreOffice/Word se houver na máquina; senão o README mantém "não verificado visualmente").

## Pesquisa jurídica (21/10/2026, fontes oficiais)

Texto lido na íntegra nas fontes abaixo (download direto; trechos revogados descartados). Toda regra usada no plano:

| #   | Regra usada                                                                                                                                                                                                                                                                                                                                                                                                        | Norma exata                                                                                            | Fonte oficial                                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| L1  | CIPA chama-se **Comissão Interna de Prevenção de Acidentes e de Assédio**                                                                                                                                                                                                                                                                                                                                          | Lei 14.457/2022, art. 23; NR-5 (texto da Portaria MTP 422/2021, alterada pela Portaria MTP 4.219/2022) | [Lei 14.457](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/lei/l14457.htm) · [NR-5 (PDF)](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/NR05atualizada2023.pdf) |
| L2  | Reuniões ordinárias mensais                                                                                                                                                                                                                                                                                                                                                                                        | NR-5, 5.6.1 (5.6.1.1: ME/EPP de grau 1 e 2 podem ser bimestrais)                                       | NR-5 (PDF)                                                                                                                                                                                                                                                                                                                                       |
| L3  | Ordinárias "realizadas na organização, preferencialmente de forma presencial, podendo a participação ocorrer de forma remota"                                                                                                                                                                                                                                                                                      | NR-5, 5.6.2                                                                                            | NR-5 (PDF)                                                                                                                                                                                                                                                                                                                                       |
| L4  | Atas assinadas pelos presentes; disponibilizadas a todos os integrantes (pode ser eletrônico); deliberações e encaminhamentos disponibilizados a todos os empregados em quadro de aviso ou meio eletrônico                                                                                                                                                                                                         | NR-5, 5.6.3, 5.6.3.1, 5.6.3.2                                                                          | NR-5 (PDF)                                                                                                                                                                                                                                                                                                                                       |
| L5  | Extraordinária quando: (a) acidente do trabalho grave ou fatal; (b) solicitação de uma das representações                                                                                                                                                                                                                                                                                                          | NR-5, 5.6.4                                                                                            | NR-5 (PDF)                                                                                                                                                                                                                                                                                                                                       |
| L6  | Para cada reunião, os membros designam o secretário que redige a ata                                                                                                                                                                                                                                                                                                                                               | NR-5, 5.6.5                                                                                            | NR-5 (PDF)                                                                                                                                                                                                                                                                                                                                       |
| L7  | Vacância: motivos registrados em ata de reunião                                                                                                                                                                                                                                                                                                                                                                    | NR-5, 5.6.7                                                                                            | NR-5 (PDF)                                                                                                                                                                                                                                                                                                                                       |
| L8  | Decisões preferencialmente por consenso; sem consenso, a CIPA regula a votação                                                                                                                                                                                                                                                                                                                                     | NR-5, 5.6.8, 5.6.8.1                                                                                   | NR-5 (PDF)                                                                                                                                                                                                                                                                                                                                       |
| L9  | Atribuições (temas da pauta): riscos, inspeções, plano de trabalho, análise de acidentes, CAT "resguardados o sigilo médico e as informações pessoais", SIPAT, assédio                                                                                                                                                                                                                                             | NR-5, 5.3.1 (a)–(j)                                                                                    | NR-5 (PDF)                                                                                                                                                                                                                                                                                                                                       |
| L10 | Denúncia de assédio com anonimato da pessoa denunciante                                                                                                                                                                                                                                                                                                                                                            | Lei 14.457/2022, art. 23, II                                                                           | Lei 14.457                                                                                                                                                                                                                                                                                                                                       |
| L11 | Assembleia anual (orçamento, contribuições, contas, eleição, regimento); extraordinárias pelo síndico ou 1/4                                                                                                                                                                                                                                                                                                       | CC arts. 1.350, 1.355                                                                                  | [Código Civil compilado](https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm)                                                                                                                                                                                                                                                    |
| L12 | Quórum de deliberação e votos proporcionais às frações ideais (o app **não** calcula); convenção define convocação e quórum                                                                                                                                                                                                                                                                                        | CC arts. 1.352, 1.353, 1.334, III                                                                      | CC                                                                                                                                                                                                                                                                                                                                               |
| L13 | Assembleia não delibera se todos não forem convocados                                                                                                                                                                                                                                                                                                                                                              | CC art. 1.354                                                                                          | CC                                                                                                                                                                                                                                                                                                                                               |
| L14 | Assembleia eletrônica: não vedada na convenção; voz, debate e voto preservados; convocação informa o meio eletrônico; **ata eletrônica só depois da soma e divulgação de todos os votos**; obedece ao edital; pode ser híbrida                                                                                                                                                                                     | CC art. 1.354-A, I, II, §§ 1º, 3º, 4º (Lei 14.309/2022)                                                | CC                                                                                                                                                                                                                                                                                                                                               |
| L15 | Locatário pode votar (exceto despesas extraordinárias) se o condômino-locador não comparecer                                                                                                                                                                                                                                                                                                                       | Lei 4.591/1964, art. 24, § 4º (Lei 9.267/1996)                                                         | [Lei 4.591](https://www.planalto.gov.br/ccivil_03/leis/l4591.htm)                                                                                                                                                                                                                                                                                |
| L16 | Deliberação em reunião ou assembleia; assembleia obrigatória com mais de 10 sócios; convocação dispensada se todos comparecem ou declaram ciência por escrito                                                                                                                                                                                                                                                      | CC art. 1.072, caput, §§ 1º, 2º                                                                        | CC                                                                                                                                                                                                                                                                                                                                               |
| L17 | Edital publicado 3 vezes; 8 dias (1ª convocação) e 5 dias (posteriores)                                                                                                                                                                                                                                                                                                                                            | CC art. 1.152, § 3º                                                                                    | CC                                                                                                                                                                                                                                                                                                                                               |
| L18 | Representação por outro sócio ou advogado, mandato especificando os atos, levado a registro com a ata; sócio não vota matéria que lhe diga respeito                                                                                                                                                                                                                                                                | CC art. 1.074, §§ 1º, 2º; Manual DREI, Seção II, item 4, nota IV (dispensa se o contrato dispuser)     | CC · [Manual DREI de Ltda (IN DREI 81/2020, Anexo IV)](https://www.gov.br/empresas-e-negocios/pt-br/drei/legislacao/instrucoes-normativas/arquivos-instrucoes-normativas-em-vigor/anexo-iv-limitada_link.pdf)                                                                                                                                    |
| L19 | Mesa (presidente e secretário) escolhida entre os presentes; ata assinada pela mesa e por sócios "quantos bastem"; **cópia à Junta nos 20 dias subsequentes**                                                                                                                                                                                                                                                      | CC art. 1.075, caput, §§ 1º, 2º (aplicável à reunião: arts. 1.072, § 6º, e 1.079)                      | CC                                                                                                                                                                                                                                                                                                                                               |
| L20 | Quóruns: inciso I do art. 1.076 **revogado** e modificação do contrato por mais da metade do capital                                                                                                                                                                                                                                                                                                               | CC art. 1.076 (Lei 14.451/2022)                                                                        | CC                                                                                                                                                                                                                                                                                                                                               |
| L21 | Participação e voto a distância; reunião digital                                                                                                                                                                                                                                                                                                                                                                   | CC art. 1.080-A e parágrafo único (Lei 14.030/2020)                                                    | CC                                                                                                                                                                                                                                                                                                                                               |
| L22 | **Conteúdo obrigatório da ata** (redação da IN DREI 1/2024): I título; II nome empresarial; III preâmbulo com hora, dia, mês, ano e local; IV mesa; V disposição expressa de que atendeu às formalidades legais; VI ordem do dia **e quórum de instalação**; VII deliberações: matérias **e quóruns de aprovação**; VIII fecho **com o nome dos presentes**; IX assinaturas da mesa e de quantos bastem à validade | Manual DREI de Ltda, Cap. II, Seção II, item 4                                                         | Manual DREI                                                                                                                                                                                                                                                                                                                                      |
| L23 | Convocação de reunião pode seguir o contrato social (carta, e-mail, aplicativo de mensagem com comprovação de entrega)                                                                                                                                                                                                                                                                                             | Manual DREI, Cap. II, Seção II, item 2                                                                 | Manual DREI                                                                                                                                                                                                                                                                                                                                      |
| L24 | Semipresencial × digital; digital considerada realizada na sede; a ata informa que foi semipresencial/digital e **a forma de participação e votação a distância** (sistema eletrônico e/ou boletim de voto)                                                                                                                                                                                                        | Manual DREI, Cap. II, Seção III, itens 1 e 6 (nota I)                                                  | Manual DREI                                                                                                                                                                                                                                                                                                                                      |
| L25 | Arquivamento em até 30 dias da assinatura retroage os efeitos à data do ato                                                                                                                                                                                                                                                                                                                                        | Lei 8.934/1994, art. 36                                                                                | [Lei 8.934](https://www.planalto.gov.br/ccivil_03/leis/l8934.htm)                                                                                                                                                                                                                                                                                |

Versões conferidas: NR-5 na página oficial do MTE ("Última atualização: Portaria MTP nº 4.219, de 20 de dezembro de 2022"; nenhuma portaria posterior encontrada); IN DREI 81/2020 alterada pelas INs 55/2021, 112/2022, 11/2022, 88/2022, 1/2024 e 1/2025 (o Anexo IV publicado traz as redações até a IN 1/2024); Código Civil compilado no Planalto.

**Spec × lei vigente (a lei vence; cada conflito vira decisão abaixo):**

- **C1 (CIPA, nome e portaria):** a spec cita só a Portaria MTP 422/2021. O texto vigente inclui a Portaria MTP 4.219/2022 e o nome passou a "Comissão Interna de Prevenção de Acidentes **e de Assédio**" (L1). Título, preâmbulo e `base-legal.md` usam o nome novo.
- **C2 (CIPA, modalidade):** a spec aceita qualquer modalidade; a NR-5 manda as ordinárias acontecerem **na organização**, com participação remota possível (L3). → **D9.**
- **C3 (Ltda, quórum na ata):** a spec diz que o app "não declara se o quórum foi atingido" — continua valendo — mas o Manual DREI (redação de 2024) **exige** na ata o quórum de instalação e os quóruns de aprovação (L22 VI/VII). → **D11** (seção "Instalação" e quóruns **como declarados** ou `[PREENCHER]`; o template só imprime o capital presente **informado**).
- **C4 (Ltda, formalidades):** L22 V exige "disposição expressa de que atendeu a todas as formalidades legais". O app não pode afirmar isso sozinho. → **D6.**
- **C5 (Ltda, convocação):** a spec tem três opções; o Manual DREI admite convocação de reunião na forma do contrato social (L23). → **D10.**
- **C6 (Ltda, fecho):** L22 VIII exige o nome dos presentes no fecho (a spec não diz). O fecho lista os sócios presentes a partir do formulário.
- **C7 (Ltda, quóruns antigos):** a Lei 14.451/2022 revogou o quórum de 3/4 (L20). Nada é calculado, mas a IA pode "lembrar" a regra antiga → regra de prompt "não cite quórum legal nem artigo de lei de memória".
- **C8 (Ltda, prazo):** os 20 dias da spec estão corretos (L19); a Lei 8.934, art. 36 (30 dias, efeito retroativo — L25) é registrada em `base-legal.md` como nota, sem entrar no aviso.
- **C9 (condomínio, fecho eletrônico):** a spec pede "lavratura, leitura e aprovação"; na assembleia eletrônica ou híbrida a ata só é lavrada depois da soma e divulgação de todos os votos (L14, § 3º) → fecho próprio para essas modalidades.

**Decisões deste plano** (registradas aqui; as de produto podem ser revistas na leitura):

- **D1 Troca de tipo:** com ata gerada, um modal confirma e **descarta o resultado** (as seções mudam); `dados`, pauta, participantes (com `extras`), transcrição, mapa e tom ficam. Campos de outro tipo continuam no rascunho, invisíveis e fora do prompt e do documento (voltam se a pessoa voltar ao tipo); "Nova ata" os limpa. Durante operação de IA o seletor de tipo fica desabilitado com `MOTIVO_IA_OCUPADA` (o resultado de um tipo nunca cai em outro).
- **D2 Id de campo compartilhado = mesmo significado:** `data`, `inicio`, `fim`, `modalidade`, `local`, `plataforma`, `natureza`, `presidente`, `secretario` têm o mesmo `tipo` e os mesmos **valores** de opção em todos os tipos que os usam (rótulos podem mudar; teste de invariante no registro). Valor de `escolha` fora das opções do tipo atual conta como **falta** (ex.: `remota` vindo da corporativa para a CIPA).
- **D3 O que vai para a IA:** de cada participante seguem nome, papel, presença e só os extras com `enviarParaIA: true` (CIPA: representação e condição; condomínio: vínculo; Ltda: procurador). **Unidade, fração ideal e participação no capital nunca vão** (spec 5.2).
- **D4 Assinaturas em grupos, sem deduplicar por nome:** CIPA = todos os presentes; condomínio = mesa (+ "Condôminos presentes" se a pessoa escolher); Ltda = mesa + sócios presentes (ou o procurador). Quem é da mesa e também participante assina nas duas qualidades — juntar por nome digitado seria adivinhar.
- **D5 CIPA:** representação obrigatória com a opção "Convidado(a) (não membro)"; condição (titular/suplente) opcional, para convidados não travarem a geração.
- **D6 Ltda, declaração de formalidades:** campo opcional "A mesa declara atendidas as formalidades legais"; sem ele, o preâmbulo sai com `[PREENCHER: declaração da mesa de que foram atendidas as formalidades legais]`.
- **D7 Ltda, capital:** aritmética em inteiros (centésimos de ponto percentual; quotas inteiras). Soma de todos acima de 100% (ou acima do total de quotas) → alerta no formulário e `[PREENCHER: capital social representado pelos presentes]` no documento; nunca bloqueia a geração (formato inválido, sim, bloqueia).
- **D8 Avisos finais no documento:** além do aviso de minuta, a CIPA imprime a nota de disponibilização (spec 14.6), o condomínio aponta a convenção e a Ltda imprime prazo de arquivamento e conferência profissional (spec 7.4 d), mais a nota de procuração quando houver procurador.
- **D9 CIPA, modalidade:** "Presencial" e "Presencial, com participação remota"; local sempre obrigatório.
- **D10 Ltda, convocação:** quatro opções — dispensada pela presença de todos; dispensada por ciência escrita; na forma do contrato social; edital publicado.
- **D11 Ltda, seção "Instalação":** a IA registra o quórum de instalação **como declarado**; sem declaração, `[PREENCHER: quórum de instalação]`.
- **D12 Lacunas de lista:** campos de escolha de participante ganham "Preencher os vazios" (aplicar um valor a todos os participantes sem valor), para 200 condôminos não exigirem 200 cliques.

**Riscos (R):** R1 textos jurídicos sem revisão profissional — mitigado por `base-legal.md`, aviso no README e minuta em todo documento; R2 avisos impressos dentro da ata podem ir ao registro sem querer — o DOCX é editável e o aviso de minuta já exige revisão; R3 campos de outro tipo ficam na `sessionStorage` até "Nova ata" (não vão para a IA nem para o documento); R4 o Manual DREI muda com frequência (5 alterações desde 2020) — `base-legal.md` traz a data da consulta.

## Global Constraints

- **Sem backend e sem rede nova.** Nenhuma requisição além de `api.openai.com`, `generativelanguage.googleapis.com`, `api.anthropic.com`. A CSP de `apps/web/csp.config.js` **não muda** (se uma exceção parecer inevitável, parar e registrar). Nenhum script, fonte, CSS ou imagem de terceiros em tempo de execução.
- **Nenhum `dangerouslySetInnerHTML`**; saída da IA sempre texto puro.
- **Texto visível em pt-BR com acentuação correta.** Mensagens de erro com causa + ação. Erro vindo de biblioteca nunca exibido nem registrado.
- **Chave de API:** só em memória por padrão; `localStorage` apenas com "Lembrar neste navegador". Nunca em URL, console, mensagem de erro, `sessionStorage` ou rascunho serializado.
- **Transcrição e resultado nunca em `localStorage`**; rascunho em `sessionStorage`. **A logo nunca entra em `AtaDraft`** (chave própria `lavra:logo:v1`).
- **Datas sem `Date` com fuso:** toda data é string `AAAA-MM-DD`, formatada por `dataOuNulo`/`dataPorExtensoOuNulo`.
- **Valores com mais de uma possibilidade real em constante nomeada em fonte única** (`src/config/*` ou no módulo do tipo, exportada): pesos de coluna, larguras mínimas, textos fixos, avisos.
- **Dependências:** nenhuma nova. Se surgir necessidade, versão exata publicada há ≥ 7 dias (`minimumReleaseAge: 10080`).
- **O app nunca calcula quórum, fração ideal nem validade de deliberação.** Votos e quórum só **como declarados** na reunião; senão `[PREENCHER: …]`. A única conta permitida é a soma das participações informadas dos sócios presentes (Ltda), exibida como "capital presente informado".
- **Textos fixos escritos do zero a partir das normas** listadas em "Pesquisa jurídica"; nunca copiar modelo de terceiros. Cada texto fixo novo ganha linha em `docs/base-legal.md`.
- **Texto nunca é chave:** participante, assinatura e campo se casam por `id`; nada é deduplicado ou ligado por nome digitado.
- **Repositório público:** sem nomes de clientes; dados fictícios (CPF 529.982.247-25 e 111.444.777-35; CNPJ 11.222.333/0001-81; "Empresa Exemplo Ltda.", "Condomínio Edifício Exemplo", pessoas inventadas).
- **Testes** com `--maxWorkers=4`, uma suíte por vez. E2E roda contra o **build** (`vite preview`), com CSP ativa. Processos abertos (preview, navegador) são encerrados ao fim de cada task.

## Review Focus

1. **Trocar de tipo com rascunho preenchido:** corporativa gerada → CIPA → corporativa. Esperado: modal antes de descartar a ata; "Manter" não muda nada; ao trocar, folha volta ao "As seções aparecem aqui depois de gerar a ata.", data/horário/pauta/participantes ficam, `organizacao` reaparece ao voltar, `modalidade: remota` vira falta na CIPA, campo invisível nunca aparece no documento nem no prompt; seletor desabilitado durante a geração. Testes nos Tasks 1, 3 e 8.
2. **CIPA extraordinária sem motivo** (e motivo esquecido ao voltar para ordinária). Esperado: "Gerar ata" bloqueada com "falta: Motivo da reunião extraordinária"; de volta a ordinária, o motivo some do preâmbulo e do prompt. Testes nos Tasks 1 e 5.
3. **Condomínio com votação sem resultado declarado:** a IA nunca escreve "aprovado"/"por unanimidade" sem fala; resultado ausente vira `[PREENCHER: resultado da votação]` e entra na contagem de lacunas e no modal de download. Testes nos Tasks 6 (prompt e contagem) e 8 (E2E com fixture).
4. **Ltda com participações que não somam 100%, passam de 100% ou têm formato inválido** ("33,333", "abc", "-5", "1.000" em modo %). Esperado: inválido bloqueia com mensagem na célula; soma ≠ 100 alerta; soma > 100 alerta e o documento sai com `[PREENCHER: capital social representado pelos presentes]`; nenhuma participação vai para a IA. Testes nos Tasks 7 e 8.
5. **200 condôminos com unidade:** colar "Nome — Apto 101" × 200, preencher vínculo dos vazios de uma vez, buscar por unidade, gerar com assinaturas dos presentes. Esperado: lista utilizável, PDF com cabeçalho de tabela repetido e "Página i de N" em todas, unidades fora da requisição. Testes nos Tasks 3, 6 e 8.
6. **PDF e DOCX de cada tipo com as colunas cabendo no A4:** nenhuma palavra de cabeçalho ou de opção mais larga que a coluna; grid do DOCX somando a largura útil. Testes nos Tasks 2, 5, 6 e 7.
7. **Prompt nunca inventa quórum ou votos:** regras do tipo presentes no prompt; nenhum número de participação/fração/unidade no prompt; regra contra citar quórum legal de memória. Testes nos Tasks 2, 5, 6, 7 e 8.

---

### Task 1: Registro genérico — tipos, faltas e invariantes

**Files:**

- Modify: `apps/web/src/ata-types/types.ts`, `apps/web/src/ata-types/registry.ts`, `apps/web/src/ata-types/corporativa.ts`
- Test: `apps/web/src/ata-types/corporativa.test.ts`, `apps/web/src/ata-types/registry.test.ts` (novo)

**Interfaces:**

- Produces:

  ```ts
  // ata-types/types.ts — acréscimos
  export interface CampoDef {
    // …campos atuais…
    /** Erro de formato de um valor NÃO vazio; `null` = válido. */
    validar?: (valor: string, dados: Record<string, string>) => string | null;
    /** `inputMode` no celular. */
    teclado?: 'numeric' | 'decimal';
    /** Só campo de participante: o valor segue (mascarado) para a IA. Padrão: não segue (spec 5.2). */
    enviarParaIA?: boolean;
    /** Só campo de participante: peso da coluna nas tabelas do documento (padrão PESOS_COLUNA.extra). */
    peso?: number;
  }
  export interface Assinatura {
    nome: string;
    papel: string;
  }
  export interface GrupoAssinaturas {
    titulo: string | null;
    pessoas: Assinatura[];
  }
  export interface ResumoParticipantes {
    texto: string | null;
    alertas: string[];
  }
  export interface AtaTypeDefinition {
    // …atuais, com estas mudanças:
    rotuloPapel: string | null; // null = sem coluna de papel
    /** Campo extra que recebe o complemento de "Nome — X" (colar e adicionar); sem ele, o papel. */
    campoComplemento?: string;
    rotulos: { participantes: string; pauta: string };
    assinaturas: (d: EntradaDoDocumento) => GrupoAssinaturas[];
    avisosFinais?: (d: EntradaDoDocumento) => string[];
    resumoDosParticipantes?: (
      d: Pick<AtaDraft, 'dados' | 'participantes'>,
    ) => ResumoParticipantes | null;
  }
  // ata-types/registry.ts — acréscimos
  export type ProblemaCampo = { tipo: 'vazio' } | { tipo: 'invalido'; mensagem: string };
  export function problemaDoCampo(
    campo: CampoDef,
    valor: string | undefined,
    dados: Record<string, string>,
  ): ProblemaCampo | null;
  // vazio só se obrigatório e visível; escolha fora de `opcoes` = invalido "Escolha uma opção da lista."; `validar` ≠ null = invalido
  export interface ColunaParticipante {
    id: string; // 'nome' | 'papel' | id do extra | 'presenca'
    rotulo: string;
    peso: number;
    campo: CampoDef | null; // null para nome, papel e presença
  }
  export function colunasDeParticipantes(
    tipo: AtaTypeDefinition,
    dados: Record<string, string>,
  ): ColunaParticipante[];
  // ordem: Nome, papel (se rotuloPapel), extras visíveis (rotuloDoCampo), Presença
  ```

- `camposFaltando` passa a usar `problemaDoCampo` para `dados` **e** para extras de participante (com `ehVisivel`/`ehObrigatorio` avaliados sobre `d.dados`). Rótulo da falta: vazio → rótulo do campo; inválido → `${rótulo} (corrigir)`; uma falta por campo, nunca uma por participante.
- Corporativa: `rotulos: { participantes: 'Participantes', pauta: 'Pauta' }`; `assinaturas` devolve `[{ titulo: null, pessoas }]` ou `[]`. Comportamento idêntico (prova de paridade = testes existentes sem alteração de expectativa).
- `config/documento.ts`: `export const PESOS_COLUNA = { nome: 3, papel: 2, extra: 1.5, presenca: 2 } as const;`

- [ ] **Step 1: Testes que falham**
  - `registry.test.ts` › `invariante de ids compartilhados`: para todo id de campo (de `campos` e de `camposParticipante`) que aparece em 2+ tipos de `ATA_TYPES`, `tipo` é igual e, sendo `escolha`, o conjunto de **valores** de um tipo está contido no do outro ou é igual; ids de `campos` e `camposParticipante` não colidem entre si; `campoComplemento`, quando existe, é id de um extra de texto; todo `camposNoPrompt` existe em `campos` e o `visivelSe` desses campos só lê ids de `camposNoPrompt` (conferido chamando com um `dados` que só tem esses ids).
  - `registry.test.ts` › `problemaDoCampo`: obrigatório vazio → `vazio`; opcional vazio → `null`; invisível → `null`; escolha `'remota'` com opções `presencial|hibrida` → `invalido`; `validar` devolvendo "x" → `{ invalido, 'x' }`; `validar` nunca chamado com vazio.
  - `registry.test.ts` › `camposFaltando com extras`: tipo de teste com extra obrigatório e extra com `validar` — 3 participantes, 2 vazios → **uma** falta com o rótulo; um inválido → falta `"<rótulo> (corrigir)"`; extra com `obrigatorioSe` falso → sem falta.
  - `registry.test.ts` › `colunasDeParticipantes`: corporativa → `Nome, Cargo / empresa, Presença`; tipo com `rotuloPapel: null` e extra com `rotuloPor` → `Nome, <rótulo dinâmico>, Presença`; pesos de `PESOS_COLUNA` aplicados.
  - `corporativa.test.ts`: `assinaturas` agora em grupo `[{ titulo: null, pessoas: […] }]`; demais testes inalterados.
- [ ] **Step 2:** rodar `pnpm --filter @lavra/web test -- src/ata-types` → FAIL.
- [ ] **Step 3:** implementar tipos, `problemaDoCampo`, `colunasDeParticipantes`, `camposFaltando` e o ajuste da corporativa; atualizar chamadores de `assinaturas` só no necessário para compilar (o Task 2 faz o uso completo).
- [ ] **Step 4:** rodar a suíte inteira do web → PASS (paridade: nenhum teste antigo muda de expectativa além do formato de `assinaturas`).
- [ ] **Step 5: Commit** — `refactor(web): generaliza o registro de tipos (validação, colunas e assinaturas em grupo)`

---

### Task 2: Documento, prompt e exportação genéricos

**Files:**

- Create: `apps/web/src/document/larguras.ts`, `apps/web/src/test/medir-texto.ts`, `apps/web/src/test/tipo-de-teste.ts`
- Modify: `apps/web/src/document/build-model.ts`, `apps/web/src/generation/prompt.ts`, `apps/web/src/generation/pipeline.ts`, `apps/web/src/config/documento.ts`
- Test: `apps/web/src/document/larguras.test.ts`, `apps/web/src/document/build-model.test.ts`, `apps/web/src/generation/prompt.test.ts`, `apps/web/src/generation/pipeline.test.ts`, `apps/web/src/export/colunas-a4.test.ts` (novo)

**Interfaces:**

- Consumes: `colunasDeParticipantes`, `GrupoAssinaturas`, `PESOS_COLUNA` (Task 1).
- Produces:

  ```ts
  // document/larguras.ts
  export function largurasPorPeso(pesos: readonly number[]): number[]; // inteiros ≥ 1 somando 100, maior resto
  // config/documento.ts
  export const LARGURA_UTIL_PT = 483.28; // A4 (595,28) − 2 × PAGINA_DOCUMENTO.margemPt
  export const RESPIRO_CELULA_PT = 16; // padding horizontal máximo da célula (lightHorizontalLines)
  // test/medir-texto.ts (só teste; fontkit + @fontsource/inter latin 400/700 .woff)
  export function larguraPt(texto: string, tamanhoPt: number, negrito: boolean): number;
  // test/tipo-de-teste.ts
  export const TIPO_DE_TESTE: AtaTypeDefinition; // extras: texto obrigatório com validar, escolha com enviarParaIA, texto sem; rotuloPapel null; avisosFinais; 2 grupos de assinatura
  ```

- `construirDocumento`: tabela de participantes com `colunas`/células de `colunasDeParticipantes(tipo, d.dados)` e `larguras = largurasPorPeso(pesos)`; `colunaPresenca` = índice real; subtítulos `tipo.rotulos.participantes` e `tipo.rotulos.pauta`; para cada grupo de assinatura com pessoas: `{ tipo: 'subtitulo', texto: titulo }` (se `titulo`) + `{ tipo: 'assinaturas', pessoas }`; depois de `AVISO_MINUTA`, um bloco `aviso` por item de `avisosFinais(d)`.
- Prompt: linha de participante = nome, papel (se `rotuloPapel`), extras com `enviarParaIA` (rótulo da opção para `escolha`), presença — em `' — '`; cabeçalho `Participantes (nome — <colunas enviadas em minúsculas> — presença)`; pauta com o título `tipo.rotulos.pauta`. `rascunhoMascarado` mantém em `extras` **só** os ids com `enviarParaIA`, mascarados.
- PDF e DOCX não mudam de código: já leem `larguras`, `subtitulo`, `assinaturas` e `aviso`. Se o teste de colunas falhar por causa do renderizador, corrigir lá.

- [ ] **Step 1: Testes que falham**
  - `larguras.test.ts`: `[3,2,2]` → `[43,29,28]` (soma 100); `[1,1,1]` soma 100 com diferença ≤ 1; `[3,1.5,2,1.5,2]` soma 100; todos ≥ 1.
  - `build-model.test.ts` (com `TIPO_DE_TESTE`): colunas `['Nome', <extras visíveis>, 'Presença']` e `larguras` somando 100; extra invisível fora da tabela; `colunaPresenca` aponta "Presença"; subtítulos com `rotulos`; dois grupos → `subtitulo` + `assinaturas` cada, grupo vazio omitido; `avisosFinais` depois do `AVISO_MINUTA`, na ordem; `textosDoDocumento` inclui títulos de grupo e avisos finais; corporativa: documento idêntico ao de antes **exceto** pelas `larguras` que a tabela de participantes passa a ter (`[43,29,28]`) — prova de paridade com o `JSON.stringify` do modelo do teste existente, gravado **antes** da mudança e comparado depois de remover esse campo.
  - `prompt.test.ts`: extra com `enviarParaIA` aparece como `Ana Souza — Representante dos empregados — presente`; extra sem a flag **não** aparece (valor `"Apto 101"`/`"37,5"` ausente de `sistema + usuario`); `rotulos.pauta = 'Ordem do dia'` → bloco "Ordem do dia:".
  - `pipeline.test.ts` › `extras que não vão para a IA não saem do navegador`: adaptador falso captura o prompt; extras `{ unidade: 'Apto 101', vinculo: 'proprietario' }` com só `vinculo` marcado → `Apto 101` ausente, rótulo do vínculo presente; CPF digitado num extra marcado chega como `[CPF_1]`.
  - `colunas-a4.test.ts` (`// @vitest-environment node`), para **cada** tipo de `ATA_TYPES` com um rascunho de dados mínimos e todas as colunas visíveis: para cada coluna, `larguras[i]/100 × LARGURA_UTIL_PT − RESPIRO_CELULA_PT ≥ larguraPt(palavra, TIPOGRAFIA_DOCUMENTO.tabelaPt, negrito)` para cada palavra do cabeçalho (negrito) e de cada rótulo de opção e de presença (`ROTULO_PRESENCA`) da coluna (normal); e `largurasDxa(larguras, n)` soma `larguraUtilDxa()`. (Hoje passa só com a corporativa; os Tasks 5–7 herdam a guarda.)
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar `largurasPorPeso`, `medir-texto`, `TIPO_DE_TESTE`, as mudanças de `build-model`, `prompt` e `pipeline`.
- [ ] **Step 4:** rodar a suíte do web → PASS (testes de PDF/DOCX existentes seguem verdes).
- [ ] **Step 5: Commit** — `feat(web): colunas de participante, avisos e assinaturas por tipo no documento e no prompt`

---

### Task 3: Formulário genérico e troca de tipo

**Files:**

- Modify: `apps/web/src/domain/draft.ts`, `apps/web/src/domain/draft-reducer.ts`, `apps/web/src/features/form/TipoBlock.tsx`, `apps/web/src/features/form/DadosBlock.tsx`, `apps/web/src/features/form/ParticipantesBlock.tsx`, `apps/web/src/features/form/lista-participantes.ts`, `apps/web/src/features/form/form.module.css`
- Test: `apps/web/src/domain/draft-reducer.test.ts`, `apps/web/src/features/form/form.test.tsx`, `apps/web/src/features/form/lista-participantes.test.ts`, `apps/web/src/features/workbench/workbench.test.tsx`

**Interfaces:**

- Consumes: `problemaDoCampo`, `colunasDeParticipantes`, `campoComplemento`, `rotulos`, `resumoDosParticipantes` (Task 1); `useOperacaoIA`, `MOTIVO_IA_OCUPADA`, `Modal`, `useToast`.
- Produces:

  ```ts
  // domain/draft.ts — DraftAction (mudanças)
  | { type: 'definirTipo'; tipoId: string } // agora também zera `resultado` (mantém o resto — D1)
  | {
      type: 'adicionarParticipantes';
      nomes: string[];
      /** Complemento de cada nome, pela posição ("Nome — X"). */
      complementos?: string[];
      /** Onde o complemento entra: ausente = papel; senão o id do extra. */
      destino?: string;
    }
  | { type: 'preencherExtrasVazios'; campo: string; valor: string } // só participantes com extras[campo] vazio
  // features/form/lista-participantes.ts
  export function descreverPreenchimento(rotuloCampo: string, rotuloValor: string, quantos: number): string;
  export function normalizarBusca(texto: string): string; // já existe; a busca passa a cobrir nome, papel e extras
  ```

- **Mapa de uso (gate 1):** entrada = bloco 1 "Tipo de ata e logo" → rádio do tipo. Sem ata gerada: troca direto, toast `Tipo de ata: {rótulo}. Confira os campos marcados em “falta”.` Com ata gerada: Modal título "Trocar o tipo de ata?", texto "A ata gerada para “{rótulo atual}” será descartada, porque as seções mudam de um tipo para outro. Dados da reunião em comum, pauta, participantes e transcrição são mantidos; os campos novos aparecem marcados em “falta”.", ações "Trocar e descartar a ata gerada" (perigo) e "Manter “{rótulo atual}”" (foco inicial); depois de trocar, toast `Tipo de ata: {rótulo}. A ata gerada foi descartada; confira os campos marcados em “falta”.` Durante operação de IA: rádios `disabled` com `MOTIVO_IA_OCUPADA` em `aria-describedby`. Volta: o rádio anterior continua selecionado se a pessoa mantiver.
- Bloco 2: título do campo de pauta = `tipo.rotulos.pauta`; `CampoDado` mostra o erro de `problemaDoCampo` no blur (inválido mesmo se opcional), `inputMode` de `teclado`; `select` com valor fora das opções mostra "Selecione…" e a falta.
- Bloco 3: título = `tipo.rotulos.participantes`; cabeçalho e células de `colunasDeParticipantes`; sem `rotuloPapel`, nenhuma coluna/campo de papel; o segundo campo de "Adicionar participante" e o complemento do "Colar lista" vão para `campoComplemento` (rótulo do campo, ajuda "Aceita “Nome — {rótulo}”.") ou para o papel; célula de extra com `aria-invalid` e mensagem curta da validação abaixo (mesmo padrão de "Informe o nome."); busca cobre extras (`"101"` acha "Apto 101"). Para cada extra `escolha`, controle "Preencher os vazios — {rótulo}: [select] [Aplicar]" desabilitado quando não há vazios; aviso `descreverPreenchimento` ("Vínculo “Proprietário(a)” aplicado a 200 participantes sem valor."). `resumoDosParticipantes`: `texto` em `role="status"` sob o contador e cada alerta em `role="note"` com ícone ⚠ + texto.

- [ ] **Step 1: Testes que falham**
  - `draft-reducer.test.ts`: `definirTipo` zera `resultado`, mantém `dados` (inclusive ids de outro tipo), pauta, participantes com `extras`, transcrição, mapa e tom; `adicionarParticipantes` com `destino: 'unidade'` grava `extras.unidade` e papel vazio; sem `destino`, papel (comportamento atual); `preencherExtrasVazios` só altera quem está vazio e não toca no `id`.
  - `lista-participantes.test.ts`: `descreverPreenchimento('Vínculo','Proprietário(a)',200)` → texto acima; `1` → "…aplicado a 1 participante sem valor.".
  - `form.test.tsx` (com `TIPO_DE_TESTE` passado pela prop `tipo` de `DadosBlock`/`ParticipantesBlock`): tabela com as colunas do tipo; "Colar lista" com "Ana — Apto 101" põe `Apto 101` na coluna do complemento; célula inválida mostra a mensagem e a falta "(corrigir)"; "Preencher os vazios" aplica a 3 de 4 e anuncia; busca por "101" filtra; `resumoDosParticipantes` com alerta → `role="note"` com o texto.
  - `workbench.test.tsx` › `trocar de tipo com ata gerada pergunta e descarta`: rascunho com resultado → clicar outro tipo → modal; "Manter" → tipo e resultado intactos; repetir e confirmar → folha com "As seções aparecem aqui depois de gerar a ata.", toast com "foi descartada", data e participantes mantidos.
  - `workbench.test.tsx` › `trocar sem ata gerada não pergunta`; `durante a geração o tipo não muda` (adaptador lento → rádios desabilitados com "Aguarde a geração em andamento terminar.").
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar a suíte do web → PASS.
- [ ] **Step 5: Commit** — `feat(web): formulário guiado pelo tipo de ata e troca de tipo sem perder dados`

---

### Task 4: Base comum dos tipos formais e `docs/base-legal.md`

**Files:**

- Create: `apps/web/src/ata-types/comum-formal.ts`, `apps/web/src/ata-types/verificar-base-legal.ts`, `docs/base-legal.md`
- Test: `apps/web/src/ata-types/comum-formal.test.ts`, `apps/web/src/ata-types/verificar-base-legal.test.ts`, `apps/web/src/ata-types/base-legal.test.ts`

**Interfaces:**

- Produces:

  ```ts
  // ata-types/comum-formal.ts
  export const MODALIDADE = {
    presencial: 'presencial',
    remota: 'remota',
    hibrida: 'hibrida',
  } as const; // valores canônicos (D2)
  export function opcoesDe(
    rotulos: Partial<Record<string, string>>,
  ): { valor: string; rotulo: string }[]; // na ordem das chaves
  export function rotuloDaOpcao(
    campos: readonly CampoDef[],
    campoId: string,
    valor: string | undefined,
  ): string | null;
  export function presentes(d: Pick<EntradaDoDocumento, 'participantes'>): Participante[]; // presenca === 'presente' e nome não vazio, na ordem da lista
  export function ou(valor: string | undefined, lacuna: string): string; // textoLimpo ou preencher(lacuna)
  export function linhaSe(rotulo: string, valor: string | null | undefined): string[]; // "Rótulo: valor" ou []
  export function encerramentoComHora(fim: string | undefined, sujeito: string): string; // "…foi encerrada às 16h" | "…foi encerrada"
  export const TIPOS_FORMAIS: readonly string[]; // ['cipa', 'condominio', 'socios-ltda'] — o guarda de base legal itera por aqui
  ```

- `docs/base-legal.md` (criado aqui, preenchido pelos Tasks 5–7): título "Base legal dos modelos de ata"; parágrafo "Os modelos foram redigidos a partir das normas citadas, sem revisão de profissional da área. Cada texto fixo do template aponta para o artigo ou item que o fundamenta. Correções são bem-vindas: abra uma issue citando a norma."; seção "Fontes consultadas" (as 8 URLs da Pesquisa jurídica, com a data **21/10/2026** e a versão conferida); seção "O que o app não faz" (não calcula quórum, fração ideal nem validade; votos e quórum só como declarados; capital presente é soma do que foi informado); uma seção `## <rótulo do tipo>` por tipo com a tabela `| Trecho do template | Norma (artigo/item) | Link oficial | Consulta |`; nota final sobre a Lei 8.934/1994, art. 36 (C8).
- `verificar-base-legal.ts`: `export function verificarBaseLegal(md: string, tipos: readonly { id: string; rotulo: string }[]): string[]` (problemas; `[]` = ok). `base-legal.test.ts` (`// @vitest-environment node`) a aplica a `docs/base-legal.md` (lido por `fs`, caminho a partir de `import.meta.url`) com os tipos de `TIPOS_FORMAIS` registrados em `ATA_TYPES`. Regras: todo link `https://` é de `www.planalto.gov.br` ou `www.gov.br`; nenhum `http://`; toda linha de tabela tem 4 células não vazias e data `21/10/2026` ou posterior no formato `dd/mm/aaaa`; para cada id de `TIPOS_FORMAIS` **registrado em `ATA_TYPES`**, existe a seção `## <rótulo>` com ≥ 4 linhas. (Antes dos Tasks 5–7 nenhum está registrado: o teste valida só formato e domínios.)

- [ ] **Step 1: Testes que falham** — `comum-formal.test.ts`: `presentes` ignora ausente, justificado e nome em branco, mantém ordem; `ou('', 'local')` → `[PREENCHER: local]`; `encerramentoComHora('16:00', 'a reunião')` → "a reunião foi encerrada às 16h"; `opcoesDe` preserva a ordem; `linhaSe('CNPJ', '')` → `[]`. `verificar-base-legal.test.ts`: Markdown com link `http://exemplo.com` → problema; link `https://www.exemplo.com.br` → problema (domínio fora da lista); linha de tabela com célula vazia ou data `2026-10-21` → problema; tipo registrado sem seção → problema "falta a seção ## CIPA — …"; documento correto → `[]`. `base-legal.test.ts`: o arquivo real → `[]`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** — `feat(web): base comum dos tipos formais e documento de base legal`

---

### Task 5: Tipo CIPA

**Files:**

- Create: `apps/web/src/ata-types/cipa.ts`
- Modify: `apps/web/src/ata-types/registry.ts` (registrar), `docs/base-legal.md` (seção CIPA)
- Test: `apps/web/src/ata-types/cipa.test.ts`, `apps/web/src/export/tipos-exportacao.test.ts` (novo, parametrizado; os Tasks 6–7 acrescentam casos)

**Interfaces:**

- Consumes: Tasks 1–4.
- Produces: `export const cipa: AtaTypeDefinition` com `id: 'cipa'`, `rotulo: 'CIPA — reunião ordinária ou extraordinária'`, `descricao: 'Comissão Interna de Prevenção de Acidentes e de Assédio (NR-5).'`, `rotulos: { participantes: 'Participantes', pauta: 'Pauta' }`, `rotuloPapel: 'Cargo / função'`, `temEncaminhamentos: true`, `camposNoPrompt: ['data','natureza','motivo','modalidade','presidente','secretario']`.
- **Campos** (`*` obrigatório): `empresa*` "Empresa"; `estabelecimento` "Estabelecimento"; `gestao*` "Gestão (mandato)" (ajuda "Ex.: 2026/2027."); `numero` "Número da reunião" (`validar` inteiro 1–999 → "Use só o número da reunião (ex.: 3)."; `teclado: 'numeric'`); `natureza*` "Natureza" (`ordinaria` "Ordinária", `extraordinaria` "Extraordinária"); `motivo` "Motivo da reunião extraordinária" (visível e obrigatório se `natureza === 'extraordinaria'`; `acidente` "Acidente do trabalho grave ou fatal", `solicitacao` "Solicitação de uma das representações"; erro "Informe o motivo da reunião extraordinária."; ajuda "NR-5, item 5.6.4."); `motivo_detalhe` "Detalhe do motivo" (visível se extraordinária); `data*`, `inicio*`, `fim`; `modalidade*` (`presencial` "Presencial", `hibrida` "Presencial, com participação remota" — D9; ajuda "As reuniões ordinárias acontecem na organização; a participação pode ser remota (NR-5, item 5.6.2)."); `local*` "Local"; `plataforma` "Plataforma da participação remota" (visível se híbrida); `presidente*` "Presidente"; `secretario*` "Secretário(a) designado(a)" (ajuda "Designado(a) pelos membros para redigir a ata (NR-5, item 5.6.5).").
- **Participante:** `representacao*` "Representação" (`empregador` "Representante do empregador", `empregados` "Representante dos empregados", `convidado` "Convidado(a) (não membro)"; `enviarParaIA`, peso 2) — D5; `condicao` "Condição" (`titular` "Titular", `suplente` "Suplente"; `enviarParaIA`, peso 1.5).
- **Seções** (chave · título · instrução): `abertura` · "Abertura" · quem abriu os trabalhos e, na extraordinária, o motivo como exposto; sem repetir data, local e lista de presentes · `ata_anterior` · "Leitura da ata anterior" · leitura, correções e aprovação **só se aconteceram**; senão vazia · `pendencias_anteriores` · "Acompanhamento das pendências anteriores" · situação das ações de reuniões anteriores mencionadas; senão vazia · `discussao` · "Assuntos tratados" · por item da pauta, na ordem: acidentes e sua análise, riscos e inspeções, plano de trabalho, SIPAT, prevenção e combate ao assédio e outras formas de violência, e o que mais a conversa trouxer; vacância ou perda de mandato com os motivos ditos · `deliberacoes` · "Deliberações" · cada deliberação com a forma como foi tomada, **por consenso ou por votação, conforme dito** (com o resultado se dito); sem a forma dita, `[PREENCHER: forma de deliberação]` · `encerramento` · "Encerramento" · só comunicados e manifestações finais; a fórmula de encerramento vem do modelo.
- **Regras de prompt (texto do Lavra, pt-BR):** (1) é ata da Comissão Interna de Prevenção de Acidentes e de Assédio, regida pela NR-5; não cite itens da norma nem artigos de lei de memória; (2) deliberação por consenso ou votação só como dito; votação sem resultado dito → `[PREENCHER: resultado da votação]`; (3) não escreva diagnóstico, CID, afastamento ou outra informação de saúde de pessoa identificada; registre o acidente, a análise e as medidas; (4) em relato de assédio ou violência no trabalho, não nomeie a pessoa que denunciou nem a vítima — registre o tema, as medidas e os encaminhamentos (esta regra prevalece sobre "use os nomes exatamente"); (5) não declare que a reunião é válida nem que houve quórum; (6) use as representações da lista de participantes para atribuir posições.
- **Template:** `titulo` "Ata da {n}ª Reunião {Ordinária|Extraordinária} da CIPA — {empresa}" (sem número: "Ata de Reunião …"; sem natureza: "Ata de Reunião da CIPA"; sem empresa, sem o travessão). `cabecalho`: empresa, "Estabelecimento: …", "Gestão: …", "Data: …", "Horário: …", "Modalidade: …", "Local: …", "Plataforma: …" (só o informado). `preambulo`: "{Data por extenso}, às {hora}, nas dependências da organização, em {local}[, com participação remota por meio de {plataforma}| , com participação remota], realizou-se a {n}ª reunião {ordinária|extraordinária} da Comissão Interna de Prevenção de Acidentes e de Assédio (CIPA) de {empresa}[, estabelecimento {x}], gestão {gestão}[, convocada em razão de {acidente do trabalho grave ou fatal|solicitação de uma das representações}[: {detalhe}]], presidida por {presidente} e secretariada por {secretário}, designado(a) pelos membros para redigir esta ata. Estiveram presentes os membros e convidados relacionados a seguir." (cada ausência → `[PREENCHER: …]`; motivo só se a natureza **atual** é extraordinária). `fecho`: "Nada mais havendo a tratar, a reunião foi encerrada[ às {fim}]. E, para constar, eu, {secretário}, secretário(a) designado(a), lavrei a presente ata, que vai assinada pelos presentes." `assinaturas`: `[{ titulo: null, pessoas: presentes(d).map(p => ({ nome, papel: [rótulo representação, rótulo condição].filter(Boolean).join(' — ') || papel })) }]`. `avisosFinais`: "Disponibilize esta ata a todos os integrantes da CIPA (NR-5, item 5.6.3.1) e divulgue as deliberações e os encaminhamentos a todos os empregados, em quadro de aviso ou por meio eletrônico (NR-5, item 5.6.3.2)."
- **`docs/base-legal.md` (CIPA):** linhas para nome da comissão (L1), modalidade/local (L3), motivo da extraordinária (L5), secretário designado (L6), forma de deliberação (L8), regras de saúde e assédio do prompt (L9 g, L10), assinatura pelos presentes (L4 — 5.6.3), aviso de disponibilização (L4 — 5.6.3.1/5.6.3.2), temas da seção "Assuntos tratados" (L9).

- [ ] **Step 1: Testes que falham** (`cipa.test.ts`, rascunho completo fictício "Empresa Exemplo Ltda.", 4 membros + 1 convidado, 1 ausente justificado)
  - campos: extraordinária sem motivo → falta "Motivo da reunião extraordinária"; ordinária → motivo invisível e sem falta; `modalidade: 'remota'` → falta "(corrigir)".
  - preâmbulo exato de um caso completo (string inteira no teste) e de um extraordinário por acidente com detalhe; extraordinária → ordinária com `motivo` ainda em `dados` → preâmbulo **sem** "convocada em razão" e prompt sem a linha de motivo.
  - título: "Ata da 3ª Reunião Ordinária da CIPA — Empresa Exemplo Ltda."; sem número → "Ata de Reunião Ordinária da CIPA — …".
  - assinaturas: só os presentes (4), papel "Representante dos empregados — Titular"; o ausente não assina.
  - documento: termina com `AVISO_MINUTA` + aviso 5.6.3.1/5.6.3.2; colunas `Nome, Cargo / função, Representação, Condição, Presença`.
  - prompt: contém as 6 regras do tipo; contém "Representante dos empregados"; não contém "5.6." nem "Gestão".
  - `colunas-a4.test.ts` (Task 2) passa com a CIPA registrada; `base-legal.test.ts` exige a seção CIPA.
  - `tipos-exportacao.test.ts` (`// @vitest-environment node`): CIPA com 12 participantes → `gerarPdf` contém "Comissão Interna de Prevenção de Acidentes e de Assédio", "Representação" e "5.6.3.2"; `gerarDocx` com `w:gridCol` da tabela de participantes somando 9666 e o aviso no `document.xml`.
- [ ] **Step 2–4:** FAIL → implementar e escrever a seção CIPA de `base-legal.md` → PASS.
- [ ] **Step 5: Commit** — `feat(web): adiciona a ata de reunião da CIPA (NR-5)`

---

### Task 6: Tipo condomínio

**Files:**

- Create: `apps/web/src/ata-types/condominio.ts`
- Modify: `apps/web/src/ata-types/registry.ts`, `docs/base-legal.md`, `apps/web/src/test/documento-volume.ts` (`modeloDeVolume` aceita `tipo` e extras)
- Test: `apps/web/src/ata-types/condominio.test.ts`, `apps/web/src/export/tipos-exportacao.test.ts`

**Interfaces:**

- Produces: `export const condominio: AtaTypeDefinition` — `id: 'condominio'`, `rotulo: 'Condomínio — assembleia geral'`, `descricao: 'Assembleia ordinária ou extraordinária de condôminos (Código Civil).'`, `rotulos: { participantes: 'Condôminos', pauta: 'Ordem do dia' }`, `rotuloPapel: null`, `campoComplemento: 'unidade'`, `temEncaminhamentos: true`, `camposNoPrompt: ['data','natureza','chamada','modalidade','presidente','secretario']`.
  ```ts
  // test/documento-volume.ts
  export function modeloDeVolume(n: {
    participantes: number;
    encaminhamentos: number;
    logo?: boolean;
    tipoId?: string;
    dados?: Record<string, string>;
    extras?: (i: number) => Record<string, string>;
  }): DocumentModel;
  ```
- **Campos:** `condominio*` "Condomínio" (ajuda "Nome do condomínio, como na convenção."); `cnpj` "CNPJ" (`validar`: `isValidCnpj` → "CNPJ inválido: os dígitos verificadores não conferem. Confira o número."); `endereco*` "Endereço"; `natureza*` (`ordinaria` "Ordinária (AGO)", `extraordinaria` "Extraordinária (AGE)"); `chamada` "Convocação" (`primeira` "Primeira convocação", `segunda` "Segunda convocação"); `edital_data` "Data do edital" (data); `data*`, `inicio*`, `fim`; `modalidade*` (`presencial` "Presencial", `remota` "Eletrônica", `hibrida` "Híbrida (presencial e eletrônica)"; ajuda "Assembleia eletrônica só se a convenção não a proibir (Código Civil, art. 1.354-A)."); `local` (visível/obrigatório se presencial ou híbrida); `plataforma` "Plataforma eletrônica" (visível/obrigatório se eletrônica ou híbrida); `presidente*` "Presidente da mesa"; `secretario*` "Secretário(a)"; `assinaturas_presentes` "Quem assina a ata" (`mesa` "A mesa (presidente e secretário)", `todos` "A mesa e os condôminos presentes"; vazio = `mesa`; ajuda "Siga o que a convenção exige.").
- **Participante:** `unidade*` "Unidade" (peso 1.5, nunca à IA); `vinculo*` "Vínculo" (`proprietario` "Proprietário(a)", `procurador` "Procurador(a)", `locatario` "Locatário(a)"; `enviarParaIA`, peso 2); `fracao` "Fração ideal" (texto livre, peso 1.5, nunca à IA, nunca somada).
- **Seções:** `abertura_instalacao` · "Abertura e instalação" · abertura e o quórum de instalação **como declarado** na assembleia (sem declaração: `[PREENCHER: quórum de instalação declarado]`); nunca calcule nem deduza da lista · `eleicao_mesa` · "Eleição da mesa" · só se houve escolha da mesa na reunião; senão vazia · `ordem_do_dia` · "Deliberações da ordem do dia" · para cada item, na ordem: a discussão e o **resultado da votação como declarado** (votos a favor, contra e abstenções, se ditos); sem resultado dito, `[PREENCHER: resultado da votação]`; sessão permanente só se dita · `encerramento` · "Encerramento" · comunicados finais.
- **Regras de prompt:** (1) assembleia geral de condôminos regida pelo Código Civil e pela convenção; não cite artigos de memória; (2) nunca calcule quórum, maioria, fração ideal nem peso de voto; (3) não escreva "aprovado", "rejeitado" ou "por unanimidade" sem que o resultado tenha sido dito; (4) não declare que a assembleia ou uma deliberação é válida; (5) mantenha unidades como aparecem na transcrição, sem completar.
- **Template:** `titulo` "Ata da Assembleia Geral {Ordinária|Extraordinária} — {condomínio}" (sem natureza: "Ata da Assembleia Geral"). `cabecalho`: condomínio, "CNPJ: …", endereço, data, horário, modalidade, local, plataforma. `preambulo`: "{Data por extenso}, às {hora}[, em {primeira|segunda} convocação], {local: 'em {local}' | eletrônica: 'por meio eletrônico, pela plataforma {plataforma}, nos termos do edital de convocação' | híbrida: 'em {local} e, simultaneamente, por meio eletrônico, pela plataforma {plataforma}'}, reuniram-se em Assembleia Geral {Ordinária|Extraordinária} os condôminos do {condomínio}, situado em {endereço}, {convocados por edital de {dd/mm/aaaa} | convocados na forma da convenção}, para deliberar sobre a ordem do dia a seguir. A mesa foi composta por {presidente}, presidente, e {secretário}, secretário(a)." `fecho` presencial: "Nada mais havendo a tratar, o presidente encerrou a assembleia[ às {fim}], e eu, {secretário}, secretário(a), lavrei a presente ata, que, lida e achada conforme, vai assinada por mim e pelo presidente[ e pelos condôminos presentes]." `fecho` eletrônica/híbrida (C9): "Concluída a apuração e divulgado o resultado de todos os votos, o presidente encerrou a assembleia[ às {fim}], e eu, {secretário}, secretário(a), lavrei a presente ata, em forma eletrônica, que vai assinada por mim e pelo presidente[ e pelos condôminos presentes]." `assinaturas`: grupo "Mesa" (presidente "Presidente", secretário "Secretário(a)", cada um só se preenchido) + grupo "Condôminos presentes" se `todos` (`papel` "{vínculo} — unidade {u}", ex.: "Proprietário(a) — unidade Apto 101"). `avisosFinais`: "Confira a convenção do condomínio: ela define a forma de convocação, o quórum de cada deliberação e quem assina a ata (Código Civil, art. 1.334, III)."
- **`docs/base-legal.md` (condomínio):** natureza AGO/AGE (L11), convocação de todos (L13), modalidade eletrônica/híbrida e "nos termos do edital" (L14 I, § 1º, § 4º), fecho eletrônico (L14 § 3º), vínculo locatário (L15), "app não calcula quórum/fração" (L12), aviso da convenção (L12 — 1.334 III), mesa (presidente e secretário — prática da convenção; registrar como "sem exigência legal específica; segue a convenção").

- [ ] **Step 1: Testes que falham** (`condominio.test.ts`, "Condomínio Edifício Exemplo", CNPJ 11.222.333/0001-81)
  - `cnpj` `11.222.333/0001-82` → inválido com a mensagem; vazio → sem falta.
  - preâmbulo exato para presencial (com edital e 2ª convocação) e para eletrônica sem edital; fecho presencial com `todos` e eletrônico com `mesa` (strings inteiras).
  - assinaturas: `mesa` → 1 grupo de 2; `todos` com 3 presentes e 1 ausente → grupo "Condôminos presentes" com 3, papel "Proprietário(a) — unidade Apto 101"; secretário vazio → só o presidente.
  - prompt: regras (2) e (3) presentes; `Apto 101` e a fração `0,0125` ausentes; "Proprietário(a)" presente.
  - documento com resultado cuja seção `ordem_do_dia` traz `[PREENCHER: resultado da votação]` → `contarPreencher` conta 1.
  - `tipos-exportacao.test.ts`: **volume** `modeloDeVolume({ participantes: 200, encaminhamentos: 20, tipoId: 'condominio', dados: { assinaturas_presentes: 'todos', … }, extras: i => ({ unidade: 'Apto ' + (101 + i), vinculo: 'proprietario' }) })` → PDF com `totalPages ≥ 5`, cada página `Página i de N`, toda página com "Participante de volume nº" contém "Unidade" (cabeçalho repetido); o texto inteiro contém "Condôminos presentes" e 200 ocorrências de "unidade Apto"; geração < 15 s; DOCX com `<w:tblHeader/>` e 200 ocorrências de "unidade Apto" no `document.xml`.
- [ ] **Step 2–4:** FAIL → implementar + seção de `base-legal.md` → PASS.
- [ ] **Step 5: Commit** — `feat(web): adiciona a ata de assembleia geral de condomínio`

---

### Task 7: Capital informado e tipo sócios de Ltda

**Files:**

- Create: `apps/web/src/ata-types/capital.ts`, `apps/web/src/ata-types/socios-ltda.ts`
- Modify: `apps/web/src/ata-types/registry.ts`, `docs/base-legal.md`
- Test: `apps/web/src/ata-types/capital.test.ts`, `apps/web/src/ata-types/socios-ltda.test.ts`, `apps/web/src/export/tipos-exportacao.test.ts`

**Interfaces:**

- Produces:

  ```ts
  // ata-types/capital.ts (puro; D7)
  export type ModoCapital = 'percentual' | 'quotas';
  export function lerPercentual(texto: string): number | null; // centésimos de ponto: "33,33"→3333, "33.33"→3333, "25 %"→2500, "100"→10000; null: vazio, negativo, >100, >2 casas, "1.000", letras
  export function lerQuotas(texto: string): number | null; // inteiro > 0: "1.000"→1000, "1000"→1000; null: "0", "1,5", "-3", "1.00"
  export function formatarPercentual(centesimos: number): string; // 7500→"75%", 3330→"33,3%", 3333→"33,33%"
  export function formatarQuotas(n: number): string; // 1000→"1.000"
  export interface ResumoCapital {
    modo: ModoCapital;
    /** Soma dos presentes em centésimos de ponto; null se algum presente sem valor válido, total inválido ou soma de todos acima do total. */
    presente: number | null;
    /** Soma de todos os listados (centésimos no modo %, quotas no modo quotas); null se algum inválido. */
    somaTodos: number | null;
    totalQuotas: number | null;
    presenteQuotas: number | null;
  }
  export function resumirCapital(
    dados: Record<string, string>,
    participantes: readonly Participante[],
  ): ResumoCapital;
  export function textoCapitalPresente(r: ResumoCapital): string | null; // "75%" | "750 de 1.000 quotas (75%)" | null
  export function quotasParaCentesimos(quotas: number, total: number): number; // arredonda meio para cima: 1 de 3 → 3333
  ```

  `export const sociosLtda: AtaTypeDefinition` — `id: 'socios-ltda'`, `rotulo: 'Sócios de Ltda — reunião ou assembleia'`, `descricao: 'Deliberação dos sócios de sociedade limitada (Código Civil e DREI).'`, `rotulos: { participantes: 'Sócios', pauta: 'Ordem do dia' }`, `rotuloPapel: null`, `campoComplemento: 'participacao'`, `temEncaminhamentos: true`, `camposNoPrompt: ['data','forma','modalidade','convocacao','presidente','secretario']`.

- **Campos:** `razao_social*` "Nome empresarial"; `cnpj*` (validar `isValidCnpj`, mesma mensagem do condomínio — constante única em `comum-formal.ts`); `nire` "NIRE" (validar: 11 dígitos após tirar não dígitos → "O NIRE tem 11 dígitos."); `sede*` "Endereço da sede"; `forma*` "Forma" (`reuniao` "Reunião de sócios", `assembleia` "Assembleia de sócios"); `data*`, `inicio*`, `fim`; `modalidade*` (`presencial` "Presencial", `remota` "Digital", `hibrida` "Semipresencial"); `local` (visível/obrigatório se presencial ou semipresencial); `plataforma` "Sistema eletrônico" (visível/obrigatório se digital ou semipresencial); `participacao_distancia` "Participação e voto a distância" (visível/obrigatório se digital ou semipresencial; `sistema` "Atuação remota por sistema eletrônico", `boletim` "Boletim de voto a distância", `ambos` "Sistema eletrônico e boletim de voto a distância"); `convocacao*` "Convocação" (`presenca_todos` "Dispensada: todos os sócios presentes", `ciencia_escrita` "Dispensada: todos declararam ciência por escrito", `contrato` "Na forma do contrato social", `edital` "Edital publicado") — D10; `convocacao_detalhe` (visível/obrigatório se `contrato` ou `edital`; `rotuloPor`: contrato → "Meio e data da convocação", edital → "Veículos e datas das publicações"); `presidente*`, `secretario*`; `modo_capital*` "Participação informada em" (`percentual` "Percentual (%)", `quotas` "Quotas"); `total_quotas` "Total de quotas do capital" (visível/obrigatório se quotas; `validar` via `lerQuotas` → "Use um número inteiro de quotas (ex.: 1.000)."; `teclado: 'numeric'`); `declaracao_formalidades` "Declaração de formalidades" (`sim` "A mesa declara atendidas as formalidades legais"; opcional; ajuda "Exigida para o registro (Manual DREI). Sem ela, a ata sai com [PREENCHER].") — D6.
- **Participante:** `participacao*` (`rotuloPor`: % → "Participação (%)", quotas → "Quotas"; `validar` pelo modo → "Use um percentual de 0 a 100, com até duas casas decimais (ex.: 33,33)." / "Use um número inteiro de quotas (ex.: 1.000)."; `teclado: 'decimal'`; peso 2, para "Participação" caber no cabeçalho; nunca à IA); `procurador` "Representado(a) por" (texto; `enviarParaIA`; peso 2.5).
- **Seções:** `instalacao` · "Instalação" · abertura e quórum de instalação **como declarado**; sem declaração `[PREENCHER: quórum de instalação]` (D11) · `deliberacoes` · "Deliberações" · por item da ordem do dia: matéria, votos **como declarados** (inclusive dissidências, abstenções e impedimentos), e o quórum de aprovação **se dito**; sem votos ditos `[PREENCHER: votos e quórum de aprovação]` · `encerramento` · "Encerramento" · comunicados finais.
- **Regras de prompt:** (1) deliberação de sócios de sociedade limitada; (2) não calcule quórum nem percentuais de capital; não escreva "totalidade do capital", "maioria" ou "unanimidade" sem que tenha sido dito; (3) não cite quórum legal nem artigo de lei de memória (a lei mudou — C7); (4) registre dissidência, abstenção e impedimento de voto só como declarados; (5) as formalidades de convocação vêm do modelo: não as descreva.
- **Template:** `titulo` "Ata de {Reunião|Assembleia} de Sócios — {nome empresarial}" (sem forma: "Ata de Reunião ou Assembleia de Sócios"). `cabecalho`: nome, "CNPJ: …", "NIRE: …", "Sede: …", data, horário, modalidade, local, plataforma. `preambulo` (parágrafos unidos por espaço, cada lacuna `[PREENCHER: …]`):
  1. "{Data por extenso}, às {hora}, {presencial: 'em {local}' | digital: 'de forma digital, considerada realizada na sede da sociedade, por meio de {plataforma}' | semipresencial: 'de forma semipresencial, em {local} e por meio de {plataforma}'}, reuniram-se em {reunião|assembleia} os sócios de {nome}, inscrita no CNPJ sob o nº {cnpj}[, NIRE {nire}], com sede em {sede}."
  2. "Estiveram presentes ou representados sócios titulares de {textoCapitalPresente | [PREENCHER: capital social representado pelos presentes]} do capital social, conforme as participações informadas na relação a seguir."
  3. "Composição da mesa: {presidente}, presidente, e {secretário}, secretário(a)."
  4. Convocação: `presenca_todos` "Dispensadas as formalidades de convocação, nos termos do art. 1.072, § 2º, do Código Civil, em razão do comparecimento de todos os sócios." · `ciencia_escrita` "Dispensadas as formalidades de convocação, nos termos do art. 1.072, § 2º, do Código Civil, por terem todos os sócios declarado, por escrito, ciência do local, da data, da hora e da ordem do dia." · `contrato` "Convocação realizada na forma do contrato social: {detalhe}." · `edital` "Convocação por edital publicado em {detalhe}, nos termos do art. 1.152, § 3º, do Código Civil."
  5. Digital/semipresencial: "A {reunião|assembleia} foi realizada de forma {digital|semipresencial}, com participação e votação a distância por {rótulo em minúsculas}, nos termos do art. 1.080-A do Código Civil."
  6. `sim` → "A mesa declarou atendidas as formalidades legais para a realização da {reunião|assembleia}." · senão `[PREENCHER: declaração da mesa de que foram atendidas as formalidades legais]`.
     `fecho` (C6): "Nada mais havendo a tratar, foi encerrada a {reunião|assembleia}[ às {fim}], da qual se lavrou a presente ata, que, lida e achada conforme, vai assinada pelos membros da mesa e pelos sócios presentes. Sócios presentes: {Nome[, representado(a) por {procurador}]; …}." (sem presentes: `[PREENCHER: sócios presentes]`). `assinaturas`: "Mesa" (Presidente, Secretário(a)) + "Sócios presentes" (com procurador: `{ nome: procurador, papel: 'Procurador(a) de {sócio}' }`; senão `{ nome, papel: 'Sócio(a)' }`). `avisosFinais`: sempre "Arquivamento: apresente cópia desta ata à Junta Comercial nos 20 dias seguintes à {reunião|assembleia} (Código Civil, art. 1.075, § 2º). Peça a conferência de um profissional (advogado ou contador) antes de assinar e registrar."; com algum procurador entre os presentes: "Representação por procurador: o mandato deve especificar os atos autorizados e acompanhar a ata no registro, salvo disposição diversa do contrato social (Código Civil, art. 1.074, § 1º)."
- **`resumoDosParticipantes`:** `texto` "Capital presente informado: {textoCapitalPresente}" (null se não calculável); `alertas` (ordem fixa): soma > 100% (ou > total de quotas) → "As participações informadas somam {x}, acima de {100% | total de quotas}. Corrija: a ata sai com [PREENCHER] no capital presente."; soma < 100% → "As participações informadas somam {x}. Se faltam sócios na lista, inclua-os (inclusive os ausentes)."; `presenca_todos` com algum não presente → "Você indicou que todos os sócios compareceram, mas {n} {sócio está|sócios estão} marcado(s) como ausente(s)."; `forma === 'reuniao'` e mais de 10 sócios listados → "A lista tem {n} sócios: com mais de dez, o Código Civil exige assembleia (art. 1.072, § 1º). Confira a forma escolhida."
- **`docs/base-legal.md` (Ltda):** uma linha por parágrafo do preâmbulo (L22 III, IV, V, VI; L16; L17; L23; L21; L24), capital presente informado (L22 VI + "soma do que foi informado"), fecho com nomes (L22 VIII), assinaturas da mesa e dos sócios (L19 § 1º; L22 IX), aviso de 20 dias (L19 § 2º; nota L25), aviso de procuração (L18), alerta de mais de dez sócios (L16 § 1º), regra de prompt sobre quórum antigo (L20).

- [ ] **Step 1: Testes que falham**
  - `capital.test.ts`: todos os exemplos das assinaturas acima; `quotasParaCentesimos(1, 3) === 3333`, `(2, 3) === 6667`; `resumirCapital` com 50/30/20 e o de 20 ausente → `presente 8000`, `somaTodos 10000`; 60/30/20 → `somaTodos 11000`, `presente null`; quotas 500/300/200 de 1.000 com 200 ausente → texto "800 de 1.000 quotas (80%)"; quotas com total inválido → `presente null`; participante com nome em branco ignorado; soma 99,99 não vira 100.
  - `socios-ltda.test.ts` ("Empresa Exemplo Ltda.", CNPJ 11.222.333/0001-81, NIRE `35212345678`): preâmbulo completo exato para presencial + `presenca_todos` + `sim`; digital + boletim → parágrafo 5 e "considerada realizada na sede da sociedade"; `edital` → parágrafo 4 com o detalhe e falta quando o detalhe está vazio; sem `declaracao_formalidades` → lacuna; soma 110% → preâmbulo com `[PREENCHER: capital social representado pelos presentes]` e alerta; "33,333" → falta "Participação (%) (corrigir)"; modo quotas sem total → falta "Total de quotas do capital"; fecho lista "Ana Souza; Bruno Lima, representado(a) por Carla Dias"; assinaturas com "Procurador(a) de Bruno Lima"; aviso de procuração só quando há procurador presente; 11 sócios + `reuniao` → alerta do art. 1.072, § 1º; prompt sem "37,5", sem "quotas" do formulário e com as regras (2) e (3).
  - `tipos-exportacao.test.ts`: Ltda com 8 sócios → o texto do PDF contém "do capital social, conforme as participações informadas", "nos 20 dias seguintes" e "Sócios presentes", e **não** contém "Capital presente informado" (esse resumo é só do formulário); DOCX com grid somando 9666.
  - `colunas-a4.test.ts` e `base-legal.test.ts` passam com o tipo registrado.
- [ ] **Step 2–4:** FAIL → implementar + seção de `base-legal.md` → PASS.
- [ ] **Step 5: Commit** — `feat(web): adiciona a ata de sócios de Ltda com capital presente informado`

---

### Task 8: E2E dos três tipos contra o build

**Files:**

- Create: `apps/web/e2e/tipos-formais.spec.ts`
- Modify: `apps/web/e2e/fixtures/respostas.ts` (`ataGeradaJson({ tipo?, encaminhamentos? })` com o JSON de cada tipo, escrito do zero, com uma lacuna `[PREENCHER: forma de deliberação]` na CIPA e `[PREENCHER: resultado da votação]` no condomínio), `apps/web/e2e/apoio.ts` (helpers `escolherTipo`, `preencherCampos(page, Record<rotulo, valor>)`, `colarParticipantes(page, linhas)`, `preencherVazios(page, campo, valor)`)

**Interfaces:**

- Consumes: fixture `test` com auditoria de rede/CSP de `apoio.ts`; `unpdf`, `xmlDoDocx` já usados no `exportacao.spec.ts`.

Cenários (cada um afirma `violacoes de rede = []`, `violacoes de CSP = []`, console sem erros):

1. **CIPA extraordinária:** escolher CIPA → natureza "Extraordinária" → "Gerar ata" mostra a falta "Motivo da reunião extraordinária" → escolher "Acidente do trabalho grave ou fatal" → gerar (OpenAI interceptada) → folha com "Comissão Interna de Prevenção de Acidentes e de Assédio", uma linha de assinatura por presente e o aviso 5.6.3.2; corpo da requisição contém "Representante dos empregados" e `[CPF_1]`, não contém o CPF cru; "Baixar PDF" → modal de lacuna → baixar → `ata-cipa-2026-10-14.pdf` com "5.6.3.2"; DOCX com "Representação".
2. **Condomínio com 200 condôminos:** colar 200 linhas "Condômino de volume nº 001 — Apto 101"… → "Preencher os vazios — Vínculo: Proprietário(a)" → aviso "…aplicado a 200 participantes sem valor."; buscar "Apto 150" acha 1; "Quem assina a ata: A mesa e os condôminos presentes" → gerar → folha com "Condôminos presentes"; corpo da requisição **sem** "Apto 1"; PDF com `totalPages ≥ 5`, "Página i de N" em todas, "Unidade" em toda página com "Apto 1"; `[PREENCHER: resultado da votação]` aparece na contagem do modal.
3. **Ltda:** três sócios 50 / 37,5 / 12,5 (o de 12,5 ausente) → status "Capital presente informado: 87,5%"; mudar 50 → 60 → alerta "somam 110%" e folha com `[PREENCHER: capital social representado pelos presentes]`; voltar a 50; convocação "Dispensada: todos os sócios presentes" com um ausente → alerta; modalidade "Digital" + "Boletim de voto a distância" → parágrafo do art. 1.080-A na folha; gerar → corpo da requisição sem "37,5"; PDF com "nos 20 dias seguintes" e "Sócios presentes".
4. **Troca de tipo:** corporativa gerada → clicar CIPA → modal → "Manter “Reunião corporativa”" (folha intacta) → clicar CIPA → "Trocar e descartar a ata gerada" → toast "…foi descartada…", folha com "As seções aparecem aqui depois de gerar a ata.", pauta e participantes mantidos, modalidade em falta → voltar à corporativa → "Organização" com o valor antigo. Com a resposta do provedor atrasada (`route`), os rádios de tipo ficam desabilitados com "Aguarde a geração em andamento terminar.".
5. **Celular 360×740:** para cada tipo, aba Editar com os participantes em cartões e o resumo do capital (Ltda) sem overflow horizontal (`scrollWidth <= clientWidth`).

- [ ] **Step 1:** fixtures e helpers (extraídos, não copiados); `fluxo-ata.spec.ts` e `exportacao.spec.ts` seguem PASS.
- [ ] **Step 2:** escrever os 5 cenários → `pnpm build && pnpm --filter @lavra/web e2e` → corrigir até PASS (falha do app volta ao task de origem como correção com teste unitário junto). Conferir que nenhum `vite preview` ficou rodando.
- [ ] **Step 3: Commit** — `test(web): adiciona E2E das atas de CIPA, condomínio e sócios de Ltda`

---

### Task 9: Prova de uso narrada, documentação e PR

- [ ] **Step 1 (ux-ui-defensive gate 3):** com `pnpm build` + `pnpm --filter @lavra/web preview`, narrar no relatório, começando pela URL inicial, para **cada** tipo: escolher o tipo → preencher → colar participantes (CIPA 12; condomínio 200 com "Preencher os vazios"; Ltda 8 com uma soma errada corrigida) → gerar (provedor interceptado ou chave do autor) → revisar a folha (preâmbulo, tabela com as colunas do tipo, fecho, grupos de assinatura, avisos finais) → baixar PDF (modal de lacunas) e DOCX → abrir o PDF no visualizador do navegador e capturar 1ª e última página → trocar de tipo com a ata gerada (modal, "Manter", depois trocar). Medir overflow em 1440 / ~1000 / 360 px. DOCX: abrir no LibreOffice/Word se houver na máquina; senão declarar "layout do DOCX conferido só pelo XML". Navegador do MCP de DevTools se livre; senão Playwright headless; capturas no scratchpad. Encerrar preview e navegador.
- [ ] **Step 2:** `README.md`: status "gera atas corporativa, de CIPA, de assembleia de condomínio e de sócios de Ltda e baixa em PDF e DOCX com a sua logo"; seção "Tipos de ata e base legal" (uma linha por tipo + link para `docs/base-legal.md` + "o app não calcula quórum, fração ideal nem validade; votos e quórum só como declarados"); no aviso existente, manter "sem revisão de profissional da área" e apontar `docs/base-legal.md`; em "Como funciona", acrescentar que unidade, fração ideal e participação no capital **não** vão para a IA. `SECURITY.md`: mesma frase sobre os campos de participante que ficam no navegador. `CONTRIBUTING.md`: como propor correção jurídica (issue citando a norma e o link oficial; PR atualiza o template e a linha de `base-legal.md` juntos).
- [ ] **Step 3:** gate completo (format, lint, typecheck, `test:ci` com `--maxWorkers=4`, build com `check-csp` e `check-bundle`, e2e); `grep` por nomes de terceiros (lista da memória do projeto) e por CPF/CNPJ que não sejam os fictícios; commit `docs: documenta os tipos formais e a base legal`.
- [ ] **Step 4:** controlador: push, PR "feat(web): atas de CIPA, condomínio e sócios de Ltda com base legal rastreável" com o template, a tabela C1–C9 e as decisões D1–D12 no corpo, CI verde, squash merge.
