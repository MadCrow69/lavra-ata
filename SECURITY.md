# Política de segurança

> **Projeto em construção.** Este documento descreve o design-alvo de segurança do Lavra. Itens marcados com **(planejado)** ainda não estão implementados.

## Versões suportadas

Apenas a branch `main` recebe correções de segurança. A versão publicada (demo) será gerada a partir dela **(planejado)**.

| Versão | Suportada |
| ------ | --------- |
| `main` | Sim       |
| Demais | Não       |

## Como reportar uma vulnerabilidade

Use o **relato privado de vulnerabilidades do GitHub**: [abrir um relato](https://github.com/MadCrow69/lavra-ata/security/advisories/new).

Não abra issue pública para vulnerabilidades. Inclua, se possível, os passos para reproduzir, a versão (hash do commit; o app passará a exibi-lo no rodapé **(planejado)**) e o impacto estimado. **Nunca inclua chaves de API ou dados pessoais reais** no relato.

## Modelo de ameaças

O Lavra é um site estático, sem servidor próprio. No design-alvo, a chave de IA é do usuário (BYOK) e as chamadas vão direto do navegador ao provedor escolhido **(planejado)**.

- **XSS.** O build inclui uma CSP restritiva em `<meta>` (sem `unsafe-inline` nem `unsafe-eval` em `script-src`; conexões apenas aos três provedores de IA suportados), definida em fonte única em `apps/web/csp.config.js` e imposta pelo gate `check-csp.mjs`, executado dentro de `pnpm build`. Qualquer exceção futura à CSP deve ser documentada neste arquivo, com o motivo. Uma regra de lint proíbe `dangerouslySetInnerHTML`. Quando houver saída da IA **(planejado)**, ela será texto puro, exibido como nó de texto, nunca como HTML.
- **Extensão de navegador maliciosa.** Fora do nosso controle: uma extensão com acesso à página pode ler a chave e o conteúdo. Recomendação: use uma chave com limite de gasto, mantenha desligada a opção de lembrar a chave **(planejado)** e prefira um perfil de navegador sem extensões.
- **Chave de API em `localStorage`.** Se a pessoa optar por lembrar a chave **(planejado)**, ela ficará no `localStorage`, legível por qualquer script da mesma origem. Por isso o padrão previsto é não persistir, e a CSP restringe quais scripts rodam e para onde o navegador pode conectar.
- **Dados enviados ao provedor de IA.** Identificadores pessoais brasileiros (CPF, CNPJ, telefone, e-mail etc.) serão trocados por marcadores antes do envio **(planejado)**. Nomes de pessoas e informações sensíveis em linguagem natural **não** serão mascarados; o conteúdo segue sob os termos do provedor escolhido.
- **Dependências comprometidas.** Hoje: lockfile, versões exatas de dependências, Dependabot (atualizações semanais com período de espera) e `pnpm audit` no CI. O pnpm só aceita versões publicadas há pelo menos 7 dias (`minimumReleaseAge`), alinhado ao período de espera do Dependabot. A análise estática com CodeQL é **(planejado)**. O Lavra busca manter poucas dependências em tempo de execução.
- **Clickjacking (`frame-ancestors`).** Limitação conhecida: o GitHub Pages não envia cabeçalhos HTTP personalizados, e a diretiva `frame-ancestors` não funciona em CSP definida por `<meta>`. Por isso não há proteção contra a incorporação do site em um `iframe` de terceiros.

## Fora de escopo

- Segurança, disponibilidade e retenção de dados dos provedores de IA.
- Ataques que exijam navegador, sistema operacional ou extensão já comprometidos.
- Vulnerabilidades em dependências sem vetor de exploração no Lavra (relate ao projeto de origem).
- Cabeçalhos HTTP que o GitHub Pages não permite configurar, incluindo `frame-ancestors`, conforme descrito acima.

## Conduta

Para comportamento inadequado na comunidade, consulte o [Código de Conduta](CODE_OF_CONDUCT.md).
