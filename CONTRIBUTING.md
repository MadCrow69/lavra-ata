# Como contribuir com o Lavra

Obrigado pelo interesse! Contribuições são bem-vindas: correções, melhorias e, principalmente, revisão dos modelos de ata. Ao participar, você concorda com o [Código de Conduta](CODE_OF_CONDUCT.md).

## Requisitos

- [pnpm](https://pnpm.io/installation) instalado.
- Node 24 e pnpm 10 são provisionados automaticamente por projeto (campo `packageManager` e `use-node-version` no `.npmrc`). Não é preciso instalar nem trocar o Node globalmente, nem usar corepack.
- A versão do Node fica em `.nvmrc` e em `use-node-version` no `.npmrc`; atualize os dois juntos. O Dependabot não atualiza o Node, então patches de segurança do Node são manuais.
- O pnpm recusa versões de dependências publicadas há menos de 7 dias (`minimumReleaseAge` em `pnpm-workspace.yaml`); é proposital, então uma versão recém-lançada só pode ser instalada depois desse prazo.
- Se o pnpm ou o Dependabot falhar com `ERR_PNPM_NO_MATURE_MATCHING_VERSION`, aguarde os 7 dias. Use `minimumReleaseAgeExclude` apenas para um patch de segurança urgente e documente o motivo no PR.

## Comandos

```bash
pnpm install                    # instala as dependências e ativa os hooks (lefthook)
pnpm --filter @lavra/web dev    # servidor de desenvolvimento do app
pnpm lint                       # ESLint
pnpm format:check               # Prettier (use `pnpm format` para corrigir)
pnpm typecheck                  # TypeScript em todos os pacotes
pnpm test                       # Vitest, com no máximo 4 workers
pnpm build                      # build de todos os pacotes
pnpm --filter @lavra/web e2e    # E2E (Playwright) contra o build; exige `pnpm build` antes
pnpm --filter @lavra/web cobertura:fontes   # regera a cobertura de caracteres das fontes do PDF
pnpm --filter @lavra/web metricas:fontes    # regera as métricas do Inter usadas no teste de largura das colunas
```

O `pnpm dev` não existe na raiz; use o filtro do pacote, como acima.

Na primeira vez, instale o navegador do E2E: `pnpm --filter @lavra/web exec playwright install chromium`. O E2E roda contra o `vite preview` do build, onde a CSP está ativa, e intercepta os três provedores de IA: nenhuma chamada real sai.

### Cobertura de caracteres das fontes do PDF

O aviso "caracteres que não existem na fonte do PDF" se baseia em `apps/web/src/export/pdf/cobertura-gerada.ts`, **gerado** dos mapas de caracteres (cmap) dos `.woff` que o PDF embute. Não edite o arquivo à mão e não o copie do `unicode-range` do pacote da fonte, que declara pontos sem desenho. Rode `pnpm --filter @lavra/web cobertura:fontes` e commite o resultado **sempre que trocar ou atualizar uma fonte do PDF** (inclusive subir a versão de `@fontsource/inter` ou `@fontsource/source-serif-4`); o teste `gerar-cobertura-fontes.test.ts` reprova se o arquivo estiver desatualizado.

O mesmo vale para `apps/web/src/test/metricas-inter.gerada.ts` (avanço de cada caractere do Inter regular e negrito, usado por `colunas-a4.test.ts` para provar que o cabeçalho e as opções de cada coluna de participantes cabem no A4): rode `pnpm --filter @lavra/web metricas:fontes` ao trocar a fonte do corpo; `gerar-metricas-fontes.test.ts` reprova se estiver desatualizado.

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

Os modelos de ata (CIPA, condomínio, sócios de Ltda e reunião corporativa) devem seguir a legislação brasileira, e a base de cada texto fixo está em [`docs/base-legal.md`](docs/base-legal.md). Se encontrar um erro ou uma lacuna, abra uma issue com o formulário **Corrigir modelo de ata** ou um PR, sempre indicando:

- o **artigo ou item da norma** (por exemplo, artigo do Código Civil ou item da NR-5);
- a **fonte oficial** com link (Planalto, Ministério do Trabalho e Emprego, DREI etc.);
- o trecho do modelo atual e a redação proposta.

Opinião sem fonte oficial não será incorporada. O Lavra gerará um rascunho e não substituirá a revisão de um profissional habilitado.

**Em um PR**, atualize no mesmo commit a constante do texto em `textosFixos` (em `apps/web/src/ata-types/<tipo>.ts`) e a linha correspondente de `docs/base-legal.md` (artigo ou item, link oficial e data da consulta): o teste de base legal reprova um sem o outro. Lembre-se de que o app não calcula quórum, fração ideal nem validade; texto novo não pode afirmar o que a reunião não declarou.
