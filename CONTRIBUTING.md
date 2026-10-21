# Como contribuir com o Lavra

Obrigado pelo interesse! Contribuições são bem-vindas: correções, melhorias e, principalmente, revisão dos modelos de ata. Ao participar, você concorda com o [Código de Conduta](CODE_OF_CONDUCT.md).

## Requisitos

- [pnpm](https://pnpm.io/installation) instalado.
- Node 24 e pnpm 10 são provisionados automaticamente por projeto (campo `packageManager` e `use-node-version` no `.npmrc`). Não é preciso instalar nem trocar o Node globalmente, nem usar corepack.

## Comandos

```bash
pnpm install                    # instala as dependências e ativa os hooks (lefthook)
pnpm --filter @lavra/web dev    # servidor de desenvolvimento do app
pnpm lint                       # ESLint
pnpm format:check               # Prettier (use `pnpm format` para corrigir)
pnpm typecheck                  # TypeScript em todos os pacotes
pnpm test                       # Vitest, com no máximo 4 workers
pnpm build                      # build de todos os pacotes
```

O `pnpm dev` não existe na raiz; use o filtro do pacote, como acima.

### Testes com teto de workers

Rode sempre `pnpm test`, que já limita a 4 workers (`--maxWorkers=4`). Se invocar o Vitest diretamente, mantenha o teto e não execute duas suítes ao mesmo tempo: em máquinas com pouca memória, a suíte sem limite esgota os recursos.

## Fluxo de trabalho

1. Crie uma branch a partir de `main`.
2. Faça as alterações, com testes quando houver comportamento novo.
3. Abra um Pull Request preenchendo o [template](.github/pull_request_template.md).
4. Após a aprovação, o PR é integrado com **squash merge**. O título do PR, em Conventional Commits, vira a mensagem do commit.

## Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/pt-br/), com a descrição em português e com acentuação correta.

```text
tipo(escopo): descrição curta no imperativo
```

Escopos permitidos (opcionais): `pii-br`, `web`, `ci`, `docs`, `repo`, `deps`.

Exemplo: `feat(pii-br): detecta CNPJ alfanumérico`.

Os hooks do [lefthook](https://lefthook.dev/) validam o que você commita:

- **pre-commit:** Prettier e ESLint nos arquivos em stage;
- **commit-msg:** commitlint na mensagem.

## Nada de dado real

Em issues, PRs, testes, exemplos e capturas de tela, **use somente dados fictícios**. Isso vale para CPF, CNPJ, telefones, e-mails, nomes de pessoas e empresas, endereços e trechos de reuniões reais. Nunca cole chaves de API. Se um dado real vazar para o repositório, avise pelo canal de [segurança](SECURITY.md).

## Padrões do projeto

- Texto visível ao usuário em português do Brasil, com acentuação correta.
- Nenhum script, fonte ou CSS de terceiros em tempo de execução (a CSP bloqueia).
- Nenhum HTML vindo da IA é renderizado como HTML.
- Não cite nomes de clientes, empresas ou produtos de terceiros em código, documentação, commits ou issues.

## Propor correção jurídica em modelo de ata

Os modelos de ata previstos (CIPA, condomínio, sócios de Ltda e reunião corporativa) devem seguir a legislação brasileira. Se encontrar um erro ou uma lacuna, abra uma issue com o formulário **Corrigir modelo de ata** ou um PR, sempre indicando:

- o **artigo ou item da norma** (por exemplo, artigo do Código Civil ou item da NR-5);
- a **fonte oficial** com link (Planalto, Ministério do Trabalho e Emprego, DREI etc.);
- o trecho do modelo atual e a redação proposta.

Opinião sem fonte oficial não será incorporada. O Lavra gerará um rascunho e não substituirá a revisão de um profissional habilitado.
