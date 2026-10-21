# Política de segurança

## Versões suportadas

Apenas a versão publicada a partir da branch `main` recebe correções de segurança.

| Versão | Suportada |
| ------ | --------- |
| `main` | Sim       |
| Demais | Não       |

## Como reportar uma vulnerabilidade

Use o **relato privado de vulnerabilidades do GitHub**: [abrir um relato](https://github.com/MadCrow69/lavra-ata/security/advisories/new).

Não abra issue pública para vulnerabilidades. Inclua, se possível, os passos para reproduzir, a versão (hash do commit exibido no rodapé do app) e o impacto estimado. **Nunca inclua chaves de API ou dados pessoais reais** no relato.

## Modelo de ameaças

O Lavra é um site estático, sem servidor próprio. A chave de IA é do usuário (BYOK) e as chamadas vão direto do navegador ao provedor escolhido.

- **XSS.** Mitigado por uma CSP restritiva (sem `unsafe-inline` nem `unsafe-eval` em `script-src`) e pelo fato de nenhum HTML vindo da IA ser renderizado como HTML: a saída é texto puro, exibido como nó de texto, e o projeto não usa `dangerouslySetInnerHTML`.
- **Extensão de navegador maliciosa.** Fora do nosso controle: uma extensão com acesso à página pode ler a chave e o conteúdo. Recomendação: use uma chave com limite de gasto, mantenha a opção de lembrar a chave desligada e prefira um perfil de navegador sem extensões.
- **Chave de API em `localStorage`.** Se a pessoa optar por lembrar a chave, ela fica no `localStorage`, legível por qualquer script da mesma origem. Por isso o padrão é não persistir, e a CSP restringe quais scripts rodam e para onde o navegador pode conectar.
- **Dados enviados ao provedor de IA.** Identificadores pessoais brasileiros (CPF, CNPJ, telefone, e-mail etc.) são trocados por marcadores antes do envio. Nomes de pessoas e informações sensíveis em linguagem natural **não** são mascarados; o conteúdo segue sob os termos do provedor escolhido.
- **Dependências comprometidas.** Mitigado por lockfile, versões fixas, Dependabot, CodeQL, `pnpm audit` no CI e poucas dependências em tempo de execução.
- **Clickjacking (`frame-ancestors`).** Limitação conhecida: o GitHub Pages não envia cabeçalhos HTTP personalizados, e a diretiva `frame-ancestors` não funciona em CSP definida por `<meta>`. Por isso não há proteção contra a incorporação do site em um `iframe` de terceiros.

## Fora de escopo

- Segurança, disponibilidade e retenção de dados dos provedores de IA.
- Ataques que exijam navegador, sistema operacional ou extensão já comprometidos.
- Vulnerabilidades em dependências sem vetor de exploração no Lavra (relate ao projeto de origem).
- Cabeçalhos HTTP que o GitHub Pages não permite configurar, incluindo `frame-ancestors`, conforme descrito acima.

## Conduta

Para comportamento inadequado na comunidade, consulte o [Código de Conduta](CODE_OF_CONDUCT.md).
