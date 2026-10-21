# Política de segurança

> **Projeto em construção.** Este documento descreve a segurança do Lavra como ela está hoje. O que ainda não existe está marcado com **(planejado)**.

## Versões suportadas

Apenas a branch `main` recebe correções de segurança. A versão publicada (demo) será gerada a partir dela **(planejado: o site ainda não está publicado)**.

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
- **Chave de API.** Por padrão a chave fica **só em memória** e some ao recarregar a aba. Somente se a pessoa marcar "Lembrar neste navegador" ela é gravada no `localStorage`, legível por qualquer script da mesma origem; a CSP restringe quais scripts rodam e para onde o navegador pode conectar. A chave nunca vai para URL, `sessionStorage`, rascunho, console ou mensagem de erro. O rascunho (sem chave) fica no `sessionStorage`; a transcrição e a ata gerada nunca vão para o `localStorage`.
- **Dados enviados ao provedor de IA.** Identificadores pessoais brasileiros (CPF, CNPJ, telefone, e-mail, cartão etc.) são trocados por marcadores com [`@lavra/pii-br`](packages/pii-br/README.md) **antes** do envio, e a pessoa vê o que vai para a IA ("Original" × "Enviado à IA") antes de gerar; os valores voltam ao texto só neste navegador. Nomes de pessoas e informações sensíveis em linguagem natural **não** são mascarados; o conteúdo segue sob os termos do provedor escolhido. As chamadas à OpenAI vão com `store: false`.
- **Dependências comprometidas.** Hoje: lockfile, versões exatas de dependências, Dependabot (atualizações semanais com período de espera) e `pnpm audit` no CI. O pnpm só aceita versões publicadas há pelo menos 7 dias (`minimumReleaseAge`), alinhado ao período de espera do Dependabot. A análise estática com CodeQL é **(planejado)**. O Lavra busca manter poucas dependências em tempo de execução.
- **Clickjacking (`frame-ancestors`).** Limitação conhecida: o GitHub Pages não envia cabeçalhos HTTP personalizados, e a diretiva `frame-ancestors` não funciona em CSP definida por `<meta>`. Por isso não há proteção contra a incorporação do site em um `iframe` de terceiros.

## Fora de escopo

- Segurança, disponibilidade e retenção de dados dos provedores de IA.
- Ataques que exijam navegador, sistema operacional ou extensão já comprometidos.
- Vulnerabilidades em dependências sem vetor de exploração no Lavra (relate ao projeto de origem).
- Cabeçalhos HTTP que o GitHub Pages não permite configurar, incluindo `frame-ancestors`, conforme descrito acima.

## Conduta

Para comportamento inadequado na comunidade, consulte o [Código de Conduta](CODE_OF_CONDUCT.md).
