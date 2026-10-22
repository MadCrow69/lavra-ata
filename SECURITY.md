# Política de segurança

## Versões suportadas

Apenas a branch `main` recebe correções de segurança. A versão publicada (demo) é gerada a partir dela pelo workflow [`deploy.yml`](.github/workflows/deploy.yml) a cada push na `main`, e o hash do commit aparece no rodapé do site.

| Versão | Suportada |
| ------ | --------- |
| `main` | Sim       |
| Demais | Não       |

## Como reportar uma vulnerabilidade

Use o **relato privado de vulnerabilidades do GitHub**: [abrir um relato](https://github.com/MadCrow69/lavra-ata/security/advisories/new).

Não abra issue pública para vulnerabilidades. Inclua, se possível, os passos para reproduzir, a versão (hash do commit, exibido no rodapé do app nos builds do CI) e o impacto estimado. **Nunca inclua chaves de API ou dados pessoais reais** no relato.

## Modelo de ameaças

O Lavra é um site estático, sem servidor próprio. A chave de IA é do usuário (BYOK) e as chamadas vão direto do navegador ao provedor escolhido (OpenAI, Google Gemini ou Anthropic), com `credentials: 'omit'` e `referrerPolicy: 'no-referrer'`. Nenhum servidor do Lavra recebe chave, transcrição ou ata.

- **XSS.** O build inclui uma CSP restritiva em `<meta>` (sem `unsafe-inline` nem `unsafe-eval` em `script-src`; conexões apenas aos três provedores de IA suportados), definida em fonte única em `apps/web/csp.config.js` e imposta pelo gate `check-csp.mjs`, executado dentro de `pnpm build`. Qualquer exceção à CSP deve ser documentada neste arquivo, com o motivo. Uma regra de lint proíbe `dangerouslySetInnerHTML`. A saída da IA é JSON validado por schema com **texto puro**, exibido como nó de texto: nunca há HTML vindo da IA no DOM.
- **Auditoria de rede.** O teste E2E roda contra o build, com a CSP ativa, e falha se a página fizer qualquer requisição a um host que não seja o próprio app ou os três provedores, ou se o navegador registrar uma violação de CSP. Esse teste confere também que a chave não aparece em URL, corpo da requisição nem storage, e que o CPF não sai sem máscara.
- **Extensão de navegador maliciosa.** Fora do nosso controle: uma extensão com acesso à página pode ler a chave e o conteúdo. Recomendação: use uma chave com limite de gasto, mantenha desligada a opção "Lembrar neste navegador" e prefira um perfil de navegador sem extensões.
- **Chave de API.** Por padrão a chave fica **só em memória** e some ao recarregar a aba. Somente se a pessoa marcar "Lembrar neste navegador" ela é gravada no `localStorage`, legível por qualquer script da mesma origem; a CSP restringe quais scripts rodam e para onde o navegador pode conectar. A chave nunca vai para URL, `sessionStorage`, rascunho, console ou mensagem de erro. O rascunho (sem chave) fica no `sessionStorage`; a transcrição e a ata gerada nunca vão para o `localStorage`. Unidade, fração ideal e participação no capital dos participantes (condomínio e sócios de Ltda) ficam só no navegador e nunca vão na requisição ao provedor de IA. No documento, a unidade aparece na tabela de condôminos e nas assinaturas (quando os presentes assinam); a fração ideal, só na tabela; a participação, na tabela de sócios e na soma do capital presente informado, no preâmbulo da ata de Ltda.
- **Rascunho na sessão da aba.** O rascunho fica no `sessionStorage` (só esta aba; some ao fechá-la) e contém a transcrição, a ata gerada e o mapa de mascaramento com os identificadores originais (CPF, telefone etc.). Qualquer script da mesma origem consegue lê-lo; a mitigação é a CSP, que não permite scripts de terceiros.
- **Dados enviados ao provedor de IA.** Identificadores pessoais brasileiros (CPF, CNPJ, telefone, e-mail, cartão etc.) são trocados por marcadores com [`@lavra/pii-br`](packages/pii-br/README.md) **antes** do envio, e a pessoa vê o que vai para a IA ("Original" × "Enviado à IA") antes de gerar; os valores voltam ao texto só neste navegador. Nomes de pessoas e informações sensíveis em linguagem natural **não** são mascarados; o conteúdo segue sob os termos do provedor escolhido. As chamadas à OpenAI vão com `store: false`.
- **Exportação (PDF e DOCX).** Acontece 100% no navegador, sem rede: os geradores (`pdfmake` e `docx`) são carregados sob demanda, da mesma origem, só no primeiro clique em "Baixar" (o build falha se entrarem na carga inicial), e nenhum script, fonte ou imagem vem de CDN. As fontes seguem embutidas no código (sem `fetch`) e o `pdfmake` roda com acesso a qualquer URL negado. Mensagens de erro de bibliotecas (geração, imagem, área de transferência) nunca são exibidas nem registradas, porque podem conter trechos da ata. O arquivo sai do documento já montado em memória; nada é enviado a servidor.
- **Logo da organização.** O arquivo é validado pelo **conteúdo** (assinatura do formato, não pela extensão), pelo tamanho (até 2 MB) e pelas dimensões declaradas no cabeçalho (por lado e por área) **antes** de decodificar, o que fecha a bomba de descompressão (um PNG pequeno que declara dezenas de milhares de pixels por lado). O **SVG nunca é inserido como marcação** no DOM nem no documento: é desenhado como imagem, sem executar scripts nem buscar recursos externos, e rasterizado para PNG; só o PNG segue adiante. A logo **nunca é enviada à IA** nem entra no rascunho: fica em `sessionStorage` e, somente com "Lembrar logo neste navegador", também em `localStorage`; falha ao gravar mostra um aviso e não afeta o rascunho. O teste E2E confere que SVG com `<script>`, `onload` e imagem externa não executa nada, não gera requisição e não viola a CSP.
- **Modo exemplo.** "Ver exemplo" carrega uma ata fictícia (dados e logo escritos do zero, embutidos no site, um arquivo por tipo e só baixado no clique) e **não faz nenhuma requisição fora do próprio site**: só baixa, da mesma origem, os arquivos do próprio app (o do exemplo escolhido, por exemplo). Não há chamada a provedor, e Gerar, Regerar, Ajustar e "Tentar de novo" ficam parados com o motivo à vista, mesmo com chave configurada. O E2E mede zero chamadas e nenhuma violação de CSP nos quatro exemplos. Única exceção deliberada: "Testar" no modal de chaves continua livre, porque só lista modelos do provedor e nada da ata vai junto. O exemplo substitui o rascunho da aba (com aviso antes, se houver conteúdo); a marca do modo fica em `sessionStorage` (`lavra:exemplo:v1`), fora do rascunho, e a logo fictícia vive só na memória da aba, nunca no armazenamento da logo da pessoa.
- **Preferências.** Tipo de ata, tom, cor de destaque, ordem dos provedores e modelo de cada provedor formam uma **lista fechada de campos**. Ficam em memória e em `sessionStorage`; só vão para o `localStorage` com "Lembrar preferências neste navegador" (desmarcado por padrão), e "Esquecer preferências" apaga. **Nunca** entram transcrição, ata gerada, participantes, mapa de marcadores nem chave de API; um id de modelo com cara de chave é recusado antes de ser guardado. Carregar um exemplo, ou marcar "Lembrar" dentro dele, não grava o tipo nem o tom do exemplo; trocar o tom dentro do exemplo vale só para o exemplo. Em qualquer storage bloqueado ou corrompido o app usa o padrão, sem erro.
- **Cor de destaque e CSP.** A cor escolhida (paleta fechada) chega à folha por uma propriedade CSS customizada definida pelo DOM (CSSOM), que `style-src 'self'` não bloqueia: a CSP **não tem exceção** para isso, e o E2E confere a cor calculada no build com a CSP ativa.
- **Publicação.** O site é gerado e publicado pelo workflow [`deploy.yml`](.github/workflows/deploy.yml): sem cache do pnpm no job que publica, actions fixadas por SHA completo, permissões mínimas por job (`pages: write` e `id-token: write` só no job `deploy`, que roda apenas na `main`). No PR o job `build` roda sem publicar. "Privacidade: como verificar" e o rodapé apontam para o commit publicado, para a pessoa conferir o código que está no ar.
- **Dependências comprometidas.** Hoje: lockfile, versões exatas de dependências, Dependabot (atualizações semanais com período de espera) e `pnpm audit` no CI. O pnpm só aceita versões publicadas há pelo menos 7 dias (`minimumReleaseAge`), alinhado ao período de espera do Dependabot. O CodeQL (configuração padrão do GitHub) analisa todo PR. O Lavra busca manter poucas dependências em tempo de execução.
- **Clickjacking (`frame-ancestors`).** Limitação conhecida: o GitHub Pages não envia cabeçalhos HTTP personalizados, e a diretiva `frame-ancestors` não funciona em CSP definida por `<meta>`. Por isso não há proteção contra a incorporação do site em um `iframe` de terceiros.

## Fora de escopo

- Segurança, disponibilidade e retenção de dados dos provedores de IA.
- Ataques que exijam navegador, sistema operacional ou extensão já comprometidos.
- Vulnerabilidades em dependências sem vetor de exploração no Lavra (relate ao projeto de origem).
- Cabeçalhos HTTP que o GitHub Pages não permite configurar, incluindo `frame-ancestors`, conforme descrito acima.

## Conduta

Para comportamento inadequado na comunidade, consulte o [Código de Conduta](CODE_OF_CONDUCT.md).
