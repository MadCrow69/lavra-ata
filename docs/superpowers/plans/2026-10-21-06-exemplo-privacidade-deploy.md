# Plano 06 — Modo exemplo, "Privacidade: como verificar", cor de destaque, preferências e deploy no GitHub Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Frontend tasks also follow the `ux-ui-defensive` protocol (gates 1–3); every match of example, participant or preference is by `id`, never by typed text (skill `texto-nunca-e-chave`).

**Goal:** um visitante sem chave clica em "Ver exemplo", escolhe um dos 4 tipos, vê a ata pronta (com a prévia de privacidade mostrando o que seria mascarado) e baixa o PDF em menos de 30 s, sem nenhuma requisição; qualquer pessoa confere a promessa de privacidade pela página "Privacidade: como verificar"; a folha aceita uma cor de destaque; as preferências podem ser lembradas no navegador; e o site é publicado em https://madcrow69.github.io/lavra-ata/ pelo GitHub Actions, com README (pt-BR e inglês) e GIF.

**Architecture:** os exemplos são dados puros (`src/exemplos/dados/exemplo-<tipo>.ts`), escritos do zero, carregados por `import()` sob demanda e convertidos num `AtaDraft` comum por `rascunhoDoExemplo` — a folha, a prévia de privacidade e a exportação não sabem que é exemplo. O "modo exemplo" é só um estado da bancada (`ModoExemploContext`) que bloqueia toda ação de IA e mostra o banner; sai por "Começar a minha" ou "Nova ata". A cor de destaque entra no `DocumentModel` (`corDestaque`) e os três renderizadores a aplicam ao título e aos títulos de seção. Preferências e logo passam a dividir um armazém comum extraído de `criarLogoStore` (`armazem-lembravel`: memória + `sessionStorage`, `localStorage` só com "Lembrar"). O deploy é um workflow novo que reusa o build do pacote (`tsc -b` + `vite build` + `check-csp` + `check-bundle`) e publica `apps/web/dist`.

**Tech Stack:** React 19.3, Vite 8.3.4, TypeScript 6.0.3, Vitest 5 + Testing Library + jsdom, Playwright 1.64 (inclusive gravação de vídeo para o GIF), ffmpeg (só na máquina de quem regera o GIF, fora do CI), `@lavra/pii-br`, pdfmake 0.3.11, docx 9.11.0. GitHub Actions: `actions/checkout`, `pnpm/action-setup`, `actions/setup-node` (mesmos SHAs de `ci.yml`), `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages` (versões a pesquisar no Task 8). **Nenhuma dependência nova de runtime nem de desenvolvimento.**

**Spec:** `docs/superpowers/specs/2026-10-20-lavra-design.md` (seções 2, 7.1, 7.3, 7.7, 7.8, 7.9, 9, 10, 12) · **Roteiro:** `docs/superpowers/plans/2026-10-20-00-roteiro.md` (linha 06)

**Branch/PR:** `feat/06-exemplo-privacidade-deploy`, já criada da `main` depois do merge do Plano 05 (`b9ef84d`) → PR "feat(web): modo exemplo, página de privacidade e deploy no GitHub Pages".

**Decisões deste plano** (reversíveis; as de produto podem ser revistas na leitura):

- **D1 — Exemplo substitui o rascunho, com aviso.** "Ver exemplo" troca o rascunho da aba pelo do exemplo (ação nova `substituirRascunho`). Com conteúdo no rascunho, o próprio seletor de exemplo avisa antes ("…será substituído pelo exemplo") — um passo, sem modal empilhado. A logo da pessoa nunca é tocada.
- **D2 — Modo exemplo bloqueia toda ação de IA sobre a ata** (Gerar, Regerar, Ajustar, "Tentar de novo") com o motivo à vista, mesmo com chave configurada: o banner "nada foi enviado para IA" só é verdade assim. Editar à mão e exportar continuam livres. "Testar" no modal de chaves continua livre de propósito (só lista modelos do provedor; nada da ata vai junto) — não é furo.
- **D3 — O modo exemplo sobrevive ao F5:** marca própria em `sessionStorage` (`lavra:exemplo:v1`), fora do rascunho (o formato `versao: 1` do rascunho **não muda**). Sai só por "Começar a minha" ou "Nova ata". Para a marca nunca divergir do rascunho, **os rádios de tipo ficam desabilitados no modo exemplo** com o motivo "Para ver outro tipo, use “Ver exemplo”; para a sua ata, “Começar a minha”." (ruling B2).
- **D4 — "Começar a minha" = "Nova ata" + sair do modo exemplo** (mantém tipo, tom e logo). Confirma só se a pessoa editou o exemplo (`state !== base`, identidade do rascunho carregado); exemplo intacto não tem o que perder. Desvio consciente da spec 7.7 ("limpa tudo"): mantém tipo, tom e logo como o "Nova ata" atual — registrar no PR.
- **D5 — Logo fictícia no exemplo** (spec 2, critério "ata profissional com logo"): um SVG geométrico escrito do zero, sem texto, rasterizado pelo mesmo `prepararLogo` da logo da pessoa e guardado **só** no `ModoExemploContext` (nunca no `LogoStore`). A logo da pessoa, se houver, vence. Falha ao rasterizar = exemplo sem logo, sem erro.
- **D6 — Paleta de destaque curada** (≥ 4,5:1 sobre o branco da folha, nenhuma cor da identidade do Lavra): Grafite (padrão, = `COR_TEXTO_DOCUMENTO`), Azul-marinho `#1f3a68` (11,27:1), Azul `#0b5394` (7,84:1), Verde-floresta `#1e5631` (8,64:1), Vinho `#7b1e3a` (10,05:1), Roxo `#4b2e83` (10,41:1). Aplicada **só** ao título da ata, aos subtítulos e aos títulos de seção (texto); corpo, tabelas, linhas de assinatura e lacunas ficam na tinta atual. Com o padrão, PDF e DOCX saem idênticos aos de hoje.
- **D7 — Na folha HTML a cor vai por propriedade CSS customizada** (`--cor-folha-destaque`) no `style` do `<article>` — o React a aplica via CSSOM, que `style-src 'self'` não bloqueia (o `<col style>` da folha já prova isso no E2E). A CSP não muda.
- **D8 — Preferências:** `tipoId`, `tom`, `destaque`, `ordem` dos provedores e `modelos` por provedor, numa lista fechada de campos. Memória + `sessionStorage` sempre; `localStorage` só com "Lembrar preferências neste navegador" (desmarcado por padrão). Gravadas **só por escolha explícita** da pessoa (nunca ao carregar um exemplo). Chave de API nunca é preferência (continua com o `KeyStore`).
- **D9 — "Privacidade: como verificar" é um modal** aberto pelo cabeçalho (o `Modal` existente: foco preso, Esc, volta do foco ao botão). Links do código apontam para o **commit publicado** (`/tree/<sha>/…`; em desenvolvimento, `main`).
- **D10 — Deploy em todo push na `main`, só com o gate do build** (`tsc -b`, `vite build`, `check-csp`, `check-bundle`): a `main` é protegida por ruleset (PR + check `qualidade` obrigatórios), então lint, testes e E2E já rodaram no PR (ruling Q1). O workflow de deploy **não usa cache** do pnpm (evita envenenamento de cache num job que publica). **O job `build` do deploy roda também em `pull_request`** (sem publicar): build, `configure-pages` e `upload-pages-artifact` falham **no PR**, não depois do merge (ruling B1).
- **D11 — GIF por Playwright com config própria** (`playwright.gif.config.ts`, pasta `apps/web/gif/`): fora do `testDir` do E2E (o CI nunca grava), reusa `e2e/apoio.ts` (a gravação também prova zero rede e CSP limpa) e nunca entra no bundle (o Vite só empacota o que `index.html` importa). ffmpeg em duas passadas (paleta otimizada); o script reprova GIF acima de 3 MB.
- **D12 — Exemplos fora da carga inicial:** um `import()` por tipo; o `check-bundle` ganha um marcador que só os dados dos exemplos carregam (o CPF fictício `529.982.247-25`), e o E2E confere que o chunk `exemplo-<tipo>` só é pedido depois do clique.

**Fora deste plano (sinalizado):** débito existente em `src/domain/persistence.ts` (`salvarRascunho`/`carregarRascunho` acessam `sessionStorage` direto, com `try/catch`, em vez de `storageOuNulo`; código novo deste plano usa `storageOuNulo`); tornar o job `e2e` obrigatório no CI; página 404 do Pages (app de página única, sem rotas); domínio próprio; interface em inglês (só o README.en.md); link direto para a página de privacidade por URL (fica o modal + a seção do README).

## Global Constraints

- **Repositório público:** nenhum nome de cliente, empresa ou produto de terceiros em código, dados de exemplo, commits, README ou PR; dados **fictícios** apenas (CPF 529.982.247-25 e 111.444.777-35; CNPJ 11.222.333/0001-81 e o alfanumérico 12.ABC.345/01DE-35; telefone `(11) 98888-7777`; e-mails `@example.com`; organizações com "Exemplo" no nome; pessoas inventadas). Antes de cada commit e do PR: `grep` pela lista de nomes de terceiros da memória do projeto.
- **CSP inalterada** (`apps/web/csp.config.js`): `script-src 'self'`, `style-src 'self'` sem `unsafe-inline`, `connect-src` só `https://api.openai.com https://generativelanguage.googleapis.com https://api.anthropic.com`. Se uma exceção parecer inevitável, parar e registrar.
- **Chave de API** nunca em URL, console, mensagem de erro, `sessionStorage`, rascunho serializado nem preferências; `localStorage` só com "Lembrar neste navegador" do modal de chaves.
- **Transcrição, resultado, participantes e mapa de marcadores nunca em `localStorage`** (nem dentro das preferências); rascunho em `sessionStorage`; formato do rascunho **inalterado** (`versao: 1`).
- **Todo acesso a storage em `try/catch`** via `storageOuNulo` (`src/domain/storage-ou-nulo.ts`); storage bloqueado ou corrompido = padrão, nunca exceção.
- **Dependências:** nenhuma nova. Se surgir necessidade, versão exata publicada há ≥ 7 dias (`minimumReleaseAge: 10080`), e parar para registrar antes.
- **O app nunca calcula quórum, fração ideal nem validade.** Nos exemplos, todo texto legal fixo vem do tipo (`preambulo`, `fecho`, avisos); votos, quórum e unanimidade só aparecem no resultado se estiverem ditos na transcrição; o que não foi dito sai como `[PREENCHER: …]`.
- **Conteúdo escrito do zero** (transcrições, resultados, logo SVG, README): nada copiado de outro sistema.
- **Texto visível em pt-BR com acentuação correta**; mensagens de erro com causa + ação; erro vindo de biblioteca (import dinâmico, canvas) nunca exibido nem registrado. Depois de cada ação, a interface diz o que mudou (toast ou texto).
- **Toda superfície nova tem ponto de entrada navegável e caminho de volta** (botões do cabeçalho; modal com Fechar/Esc e foco devolvido; banner com "Começar a minha").
- **Fonte única:** URLs (repositório, demo, LinkedIn, caminhos de código) em `src/config/site.ts` / `src/config/caminhos-codigo.json`; origens dos provedores em `ORIGEM_PROVEDOR`; chaves de storage em `src/config/storage-keys.ts`; paleta em `src/config/destaque.ts`. Nada de URL ou cor solta.
- **Nenhum caractere invisível ou bidi literal no código-fonte** (use `\u{…}` quando um teste precisar deles).
- **Pesquisar a documentação atual** de qualquer action/lib antes de usar; actions fixadas por **SHA completo** com o comentário da versão, como em `ci.yml`.
- **Commits:** Conventional Commits em pt-BR acentuado, por arquivo UTF-8 (`git commit -F <arquivo>`); nunca `--no-verify`; nunca `Co-Authored-By`.
- **Verificação de toda task:** `pnpm --filter @lavra/web typecheck` **e** `pnpm --filter @lavra/web test` (`--maxWorkers=4`), uma suíte por vez. E2E contra o **build** (`pnpm build && pnpm --filter @lavra/web e2e`), com CSP ativa. Processos abertos (preview, navegador, gravação) são encerrados ao fim de cada task; nunca matar processo que não foi aberto pela task.

## Review Focus

1. **"Ver exemplo" com rascunho preenchido ou durante uma geração.** Esperado: o seletor avisa que o rascunho será substituído (e que a geração será cancelada); o resultado tardio da IA nunca cai no exemplo; a logo da pessoa continua; cancelar o seletor não muda nada. Testes no Task 6.
2. **Modo exemplo com chave configurada.** Esperado: Gerar, Regerar, Ajustar e "Tentar de novo" parados com "No exemplo, nada é enviado para IA…"; nenhuma chamada a provedor durante todo o modo exemplo, em todos os 4 tipos. Testes nos Tasks 6 e 7 (`rede.chamadas = []`).
3. **Storage bloqueado, cheio ou adulterado** (modo privado, `setItem` que lança, JSON quebrado, `destaque: "rosa"`, `tipoId` desconhecido, `ordem` com provedor inventado, campo extra `transcricao` injetado). Esperado: padrão para o campo ruim, os bons aproveitados, nada lança, aviso "o navegador bloqueou o armazenamento" quando "Lembrar" falha, e nunca um campo fora da lista fechada gravado. Testes no Task 2.
4. **F5 no meio do modo exemplo e depois de "Começar a minha".** Esperado: recarregar no exemplo mantém banner, logo do exemplo e bloqueio de IA, sem o aviso "Rascunho recuperado" (o tipo não pode ser trocado dentro do exemplo, então a marca nunca diverge); depois de "Começar a minha", recarregar não traz o exemplo de volta. Testes no Task 6.
5. **360 px com quatro ações no cabeçalho, banner e o modal de privacidade.** Esperado: nada rola na horizontal, "Começar a minha" e "Ver exemplo" visíveis e alcançáveis por teclado. Teste no Task 7.
6. **Cor de destaque sem efeito colateral.** Esperado: com o padrão, PDF/DOCX idênticos aos de hoje; com outra cor, só título e títulos de seção mudam; nunca uma cor da identidade do Lavra; nenhuma violação de CSP pela propriedade customizada. Testes nos Tasks 1 e 7.

---

### Task 1: Cor de destaque no documento (folha, PDF e DOCX)

**Files:**

- Create: `apps/web/src/config/destaque.ts`, `apps/web/src/config/destaque.test.ts`, `apps/web/src/test/contraste.ts` e `apps/web/src/test/tokens.ts` (só para teste)
- Modify: `apps/web/src/config/documento.test.ts` (passa a usar `tokenDe` de `src/test/tokens.ts` — a função `token()` local é **extraída**, não copiada), `apps/web/src/document/model.ts` (`DocumentModel.corDestaque`), `apps/web/src/document/build-model.ts` (`construirDocumento`), `apps/web/src/export/pdf/definicao.ts` (`tituloDaAta`, `tituloDeSecao`), `apps/web/src/export/docx/gerar-docx.ts` (`estiloDeTitulo` recebe a cor: estilos `title`/`heading1`/`heading2`, fonte única dos títulos — não cada run), `apps/web/src/features/preview/A4Preview.tsx` (propriedade no `<article>`), `apps/web/src/features/preview/preview.module.css` (título, subtítulo e título de seção usam `var(--cor-folha-destaque, var(--cor-folha-tinta))`), literais de `DocumentModel` em testes e em `src/test/documento-volume.ts`
- Test: `apps/web/src/document/build-model.test.ts`, `apps/web/src/export/pdf/definicao.test.ts`, `apps/web/src/export/docx/gerar-docx.test.ts`, `apps/web/src/features/preview/A4Preview.test.tsx`

**Interfaces:**

- Produces:
  ```ts
  // config/destaque.ts
  export type IdDestaque = 'grafite' | 'marinho' | 'azul' | 'verde' | 'vinho' | 'roxo';
  export interface OpcaoDestaque {
    id: IdDestaque;
    rotulo: string;
    cor: string;
  } // cor '#rrggbb' minúsculo
  export const DESTAQUES: readonly OpcaoDestaque[]; // ordem e valores da D6; grafite.cor = COR_TEXTO_DOCUMENTO
  export const DESTAQUE_PADRAO: IdDestaque; // 'grafite'
  export const CONTRASTE_MINIMO_DESTAQUE = 4.5;
  export function ehIdDestaque(v: unknown): v is IdDestaque;
  export function corDoDestaque(id: string): string; // id desconhecido → cor do padrão
  // document/model.ts
  export interface DocumentModel {
    /* …atuais… */ corDestaque: string;
  }
  // document/build-model.ts
  export function construirDocumento(
    d: EntradaDoDocumento,
    tipo: AtaTypeDefinition,
    logo?: LogoDoc | null,
    destaque?: IdDestaque, // padrão DESTAQUE_PADRAO
  ): DocumentModel;
  // test/contraste.ts
  export function contrasteWcag(corA: string, corB: string): number; // fórmula WCAG 2.x de luminância relativa
  // test/tokens.ts (extraído de config/documento.test.ts)
  export function tokenDe(nome: string, bloco?: string): string | undefined; // bloco padrão ':root'; hex minúsculo
  ```
- Rótulos (exatos): "Grafite (padrão)", "Azul-marinho", "Azul", "Verde-floresta", "Vinho", "Roxo".

- [ ] **Step 1: Testes que falham**
  - `destaque.test.ts`: ids únicos; toda `cor` casa `^#[0-9a-f]{6}$`; `contrasteWcag(cor, tokenDe('--cor-folha'))` ≥ `CONTRASTE_MINIMO_DESTAQUE` para todas; nenhuma cor igual a `--cor-primaria`, `--cor-primaria-hover`, `--cor-destaque`, `--cor-destaque-texto`, `--cor-destaque-fundo` do bloco `:root` de `tokens.css` (via `tokenDe`); `config/documento.test.ts` segue verde usando `tokenDe`; a cor do padrão é `COR_TEXTO_DOCUMENTO`; `corDoDestaque('rosa') === corDoDestaque(DESTAQUE_PADRAO)`; `ehIdDestaque('vinho')` true, `ehIdDestaque('#7b1e3a')` false. `contrasteWcag('#ffffff', '#000000')` = 21 (sanidade do helper).
  - `build-model.test.ts`: sem o 4º argumento, `corDestaque === COR_TEXTO_DOCUMENTO`; com `'vinho'`, `'#7b1e3a'`.
  - `definicao.test.ts`: com `corDestaque: '#7b1e3a'`, o nó do título da ata e todo nó de título de seção/subtítulo têm `color: '#7b1e3a'`; o estilo padrão do corpo continua `COR_TEXTO_DOCUMENTO`; com o padrão, `definicaoPdf` não tem nenhum `color` diferente de `COR_TEXTO_DOCUMENTO`.
  - `gerar-docx.test.ts`: com o padrão, todo `w:color w:val` de `word/document.xml` + `word/styles.xml` ∈ {tinta (`COR_TEXTO_DOCUMENTO` sem `#`), `auto`, `LINHAS_TABELA.corPadrao` sem `#`} (sem caixa) — prova real de "padrão idêntico"; com Vinho, os estilos `Title`, `Heading1` e `Heading2` de `word/styles.xml` têm `7B1E3A` (sem caixa) e o estilo padrão do documento segue na tinta.
  - `A4Preview.test.tsx`: o `article` "Prévia da ata" tem `style.getPropertyValue('--cor-folha-destaque')` igual a `COR_TEXTO_DOCUMENTO` (padrão).
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar. PDF: os dois construtores de título recebem a cor (parâmetro), sem número/cor solta; DOCX: `estiloDeTitulo(tamanhoPt, cor)` com a cor sem `#`; folha: `style={{ '--cor-folha-destaque': modelo.corDestaque } as CSSProperties}` no `<article>`. O `A4Preview` segue chamando `construirDocumento` com 3 argumentos (o Task 2 liga a preferência).
- [ ] **Step 4:** typecheck + testes → PASS (os testes de PDF/DOCX existentes seguem verdes sem mudança de expectativa, somados aos testes de "padrão idêntico" acima).
- [ ] **Step 5: Commit** — `feat(web): adiciona cor de destaque da folha no PDF e no DOCX`

---

### Task 2: Preferências lembradas no navegador

**Files:**

- Create: `apps/web/src/domain/armazem-lembravel.ts` + `armazem-lembravel.test.ts` (gravar/apagar/restaurar por chave + validador, sessão sempre, local só com "Lembrar", local vence e é espelhado na sessão — **extraído** de `logo/logo-store.ts`, sem lógica de domínio), `apps/web/src/preferencias/preferencias-store.ts`, `apps/web/src/preferencias/preferencias-store.test.ts`, `apps/web/src/preferencias/PreferenciasContext.tsx`, `apps/web/src/features/form/DestaqueField.tsx`, `apps/web/src/features/form/LembrarPreferencias.tsx`, `apps/web/src/features/form/preferencias.test.tsx`
- Modify: `apps/web/src/logo/logo-store.ts` (passa a usar `armazem-lembravel`; `logo-store.test.ts` segue verde sem mudança de expectativa), `apps/web/src/config/storage-keys.ts` (comentário de `PREFERENCIAS`: formato `{ versao: 1, tipoId?, tom?, destaque?, ordem?, modelos? }`, sessão sempre e local só com "Lembrar"; deixa de ser "reservada"; com chaves lembradas, a `ordem`/modelo gravados em `CHAVES` prevalecem sobre os das preferências), `apps/web/src/App.tsx` (`PreferenciasProvider` por fora de `KeysProvider`), `apps/web/src/ai/keys.ts` (`criarKeyStore(storage?, ordemInicial?)`), `apps/web/src/ai/KeysContext.tsx` (prop `ordemInicial`), `apps/web/src/domain/draft-reducer.ts` (`criarRascunho(tipoId?, tom?)`), `apps/web/src/features/workbench/Workbench.tsx` (rascunho inicial com preferências), `apps/web/src/features/form/TipoBlock.tsx` (grava `tipoId`/`tom`; monta `DestaqueField` e `LembrarPreferencias` depois do tom), `apps/web/src/features/keys/KeysModal.tsx` (grava `ordem` em `mover`), `apps/web/src/features/keys/CartaoProvedor.tsx` (modelo inicial, `modo` inicial e gravação), `apps/web/src/features/preview/A4Preview.tsx` (passa `destaque` a `construirDocumento`), `apps/web/src/test/provedores.tsx` (envolve com `PreferenciasProvider` usando `criarPreferenciasStore(null, null)` por padrão, como a logo, para nada vazar entre testes)
- Test: `apps/web/src/ai/keys.test.ts`, `apps/web/src/features/keys/KeysModal.test.tsx` (monta `KeysProvider` direto: passa a envolver com `PreferenciasProvider`), `apps/web/src/features/workbench/workbench.test.tsx`, `apps/web/src/features/preview/A4Preview.test.tsx`, `apps/web/src/domain/draft-reducer.test.ts`, `apps/web/src/logo/logo-store.test.ts` — `usePreferencias` lança fora do provider (padrão de `useKeys`), sem fallback silencioso

**Interfaces:**

- Consumes: `IdDestaque`, `ehIdDestaque`, `DESTAQUES`, `DESTAQUE_PADRAO` (Task 1); `storageOuNulo`; `PREFERENCIAS`; `TONS`, `Tom`; `PROVEDORES`, `ProviderId`; `obterTipo`.
- Produces:
  ```ts
  // domain/armazem-lembravel.ts
  export interface ArmazemLembravel<T> {
    lido: T | null; // local (espelhado na sessão) ou sessão; inválido é apagado
    lembrado: boolean; // veio do local
    gravarSessao: (v: T) => boolean;
    gravarLocal: (v: T) => boolean;
    apagarSessao: () => void;
    apagarLocal: () => void;
  }
  export function criarArmazemLembravel<T>(
    chave: string,
    ler: (bruto: string) => T | null, // valida; null = inválido
    serializar: (v: T) => string,
    sessao?: Storage | null,
    local?: Storage | null, // undefined = storageOuNulo(...)
  ): ArmazemLembravel<T>; // nunca lança
  // preferencias/preferencias-store.ts
  export interface Preferencias {
    tipoId?: string;
    tom?: Tom;
    destaque?: IdDestaque;
    ordem?: ProviderId[];
    modelos?: Partial<Record<ProviderId, string>>;
  }
  /** Campos que podem ser gravados — lista FECHADA (nada fora dela chega ao storage). */
  export const CAMPOS_PREFERENCIAS: readonly (keyof Preferencias)[];
  export interface PreferenciasStore {
    atual: () => Preferencias;
    lembrar: () => boolean;
    /** Mescla na memória; grava na sessão sempre e no local se `lembrar`. Nunca lança. */
    definir: (parcial: Preferencias) => { persistiu: boolean };
    /** Marcar copia o atual para o local (recusado → lembrar false, persistiu false). Desmarcar apaga do local. */
    definirLembrar: (v: boolean) => { persistiu: boolean };
    /** "Esquecer preferências": apaga do local, lembrar false; memória e sessão ficam (valem nesta aba). */
    esquecer: () => void;
    assinar: (ouvinte: () => void) => () => void;
    revisao: () => number;
  }
  export function criarPreferenciasStore(
    sessao?: Storage | null,
    local?: Storage | null,
  ): PreferenciasStore;
  // preferencias/PreferenciasContext.tsx
  export function PreferenciasProvider(p: {
    children: ReactNode;
    store?: PreferenciasStore;
  }): JSX.Element;
  export function usePreferencias(): PreferenciasStore & { versao: number }; // mesmo padrão de useKeys
  // ai/keys.ts
  export function criarKeyStore(
    storage?: Storage | null,
    ordemInicial?: readonly ProviderId[],
  ): KeyStore;
  // ordemInicial só vale quando não há chaves lembradas; passa por normalizarOrdem
  // domain/draft-reducer.ts
  export function criarRascunho(tipoId?: string, tom?: Tom): AtaDraft; // padrões: TIPO_PADRAO_ID, 'formal'
  ```
- Leitura: cada campo validado à parte (`tipoId` só se for chave de `ATA_TYPES`; `tom` ∈ `TONS`; `destaque` por `ehIdDestaque`; `ordem` por `normalizarOrdem` — exportar de `keys.ts` em vez de copiar; `modelos` só provedores conhecidos com string não vazia, `trim`). Inválido = campo ausente; `versao !== 1` ou JSON quebrado = vazio. Local vence sessão e é espelhado nela (comportamento do `armazem-lembravel`, o mesmo da logo).
- Aplicação: `App` cria o store uma vez (`useState`) e passa `ordemInicial={store.atual().ordem}` ao `KeysProvider`; o `Workbench` usa `recuperado ?? criarRascunho(obterTipo(p.tipoId ?? '').id, p.tom)`; `A4Preview` usa `usePreferencias().atual().destaque ?? DESTAQUE_PADRAO`; `CartaoProvedor` inicia o modelo com `atual?.modelo ?? prefs.atual().modelos?.[provedor] ?? MODELOS[provedor].padrao` e calcula o `modo` inicial (`lista`/`outro`) a partir **desse** modelo efetivo, não só de `atual?.modelo`.
- Gravação **só por escolha explícita:** troca de tipo confirmada (`trocar` do `TipoBlock`), troca de tom, escolha de cor, `mover` no modal de chaves, troca de modelo no cartão. Carregar exemplo, "Nova ata" e rascunho recuperado **não** gravam.
- UI no bloco 1, depois do tom (gate 1 — entrada: bloco "Tipo de ata e logo"; saída: folha muda ao vivo + toast; volta: escolher outra cor / "Esquecer preferências"):
  - `fieldset` com legenda "Cor de destaque da folha" e texto "Usada no título e nos títulos de seção da folha, do PDF e do DOCX."; um rádio por `DESTAQUES` (amostra `aria-hidden` com `style={{ backgroundColor: cor }}` + rótulo). Ao escolher: toast `Cor de destaque: {rótulo}. A folha, o PDF e o DOCX usam a nova cor.`
  - checkbox "Lembrar preferências neste navegador" com `aria-describedby` no texto "Guarda o tipo de ata, o tom, a cor de destaque e a ordem e os modelos dos provedores. Nunca a transcrição, os participantes, a ata ou as chaves de IA." Marcar grava o atual (`tipoId`/`tom` do rascunho, `destaque`, `keys.ordem()`, modelos de `keys.listar()`) e liga; toast "Preferências lembradas neste navegador.". Recusado → `role="alert"` "Este navegador bloqueou o armazenamento; as preferências valem só nesta aba.".
  - Com "Lembrar" ligado, botão "Esquecer preferências" → `esquecer()` + toast "Preferências apagadas deste navegador. As escolhas atuais continuam valendo nesta aba."

- [ ] **Step 1: Testes que falham**
  - `preferencias-store.test.ts` (storages falsos): sem nada gravado → `{}` e `lembrar()` false; `definir({ tom: 'conciso' })` grava na sessão e **não** no local; com `definirLembrar(true)` grava no local o objeto atual; `definir` depois disso grava nos dois; JSON gravado tem só `versao` + chaves de `CAMPOS_PREFERENCIAS` mesmo com `definir({ transcricao: 'segredo', tom: 'formal' } as unknown as Preferencias)` (a string "segredo" não aparece em nenhum storage); leitura de `{ versao: 1, destaque: 'rosa', tipoId: 'xyz', tom: 'conciso', ordem: ['openai', 'xyz'] }` → `{ tom: 'conciso', ordem: ['openai', 'gemini', 'anthropic'] }`; JSON quebrado e `versao: 2` → `{}`; `setItem` que lança no local → `definirLembrar(true)` devolve `{ persistiu: false }`, `lembrar()` false, sem exceção; `getItem` que lança → `{}`; local vence sessão na abertura; `esquecer()` apaga o local, mantém `atual()`.
  - `keys.test.ts`: `criarKeyStore(storageVazio, ['anthropic', 'openai'])` → `ordem()` = `['anthropic', 'openai', 'gemini']`; com chaves lembradas no storage, a ordem gravada vence `ordemInicial`.
  - `draft-reducer.test.ts`: `criarRascunho('cipa', 'conciso')` tem `tipoId: 'cipa'`, `tom: 'conciso'`; `novaAta` segue mantendo tipo e tom.
  - `preferencias.test.tsx` (Workbench com provedores de teste): escolher "Vinho" → toast exato e o `article` com `--cor-folha-destaque` `#7b1e3a`; marcar "Lembrar…" → local com `destaque: 'vinho'`; remontar o app com o mesmo local e sessão vazia → rádio "Vinho" marcado, tipo e tom lembrados aplicados ao rascunho novo; trocar tipo para CIPA e tom → gravados; preencher transcrição e participante → o local **não** contém o texto da transcrição nem o nome; "Esquecer preferências" → local sem a chave e toast exato; storage local bloqueado → alerta exato e checkbox desmarcada.
  - `KeysModal.test.tsx`: mover Anthropic para cima grava `ordem` nas preferências; trocar o modelo grava `modelos.openai`; cartão sem chave abre com o modelo lembrado; modelo lembrado fora de `opcoes` abre em "Outro modelo…" com o id no campo "Id do modelo".
  - `armazem-lembravel.test.ts`: os casos de storage (gravar, recusar, apagar, local vence e espelha, `getItem`/`setItem` que lançam) que hoje o `logo-store.test.ts` cobre, agora sobre a função extraída com um validador falso.
- [ ] **Step 2:** FAIL → **Step 3:** implementar (extrair `armazem-lembravel` primeiro e migrar `logo-store` com os testes dele verdes; depois o store de preferências sobre ele, com `assinar`/`revisao`; `normalizarOrdem` exportada de `keys.ts`, não copiada) → **Step 4:** typecheck + testes → PASS.
- [ ] **Step 5: Commit** — `feat(web): lembra tipo, tom, cor e provedores no navegador por opção`

---

### Task 3: Página "Privacidade: como verificar"

**Files:**

- Create: `apps/web/src/config/caminhos-codigo.json`, `apps/web/src/features/privacidade/ComoVerificar.tsx`, `apps/web/src/features/privacidade/como-verificar.module.css`, `apps/web/src/features/privacidade/ComoVerificar.test.tsx`, `apps/web/src/config/site.test.ts`, `apps/web/src/config/models.test.ts`, `apps/web/scripts/caminhos-codigo.test.ts`
- Modify: `apps/web/src/config/models.ts` (`ORIGEM_PROVEDOR`), `apps/web/src/ai/providers/openai.ts`, `gemini.ts`, `anthropic.ts` (`BASE` derivado de `ORIGEM_PROVEDOR`, sem URL solta), `apps/web/src/config/site.ts`, `apps/web/src/shell/Footer.tsx` (usa `urlDoCommit`), `apps/web/src/shell/Header.tsx` (botão + modal; ordem das ações da spec 7.1), `apps/web/src/shell/AppShell.module.css` (ações quebram linha sem estourar a 360 px)
- Test: `apps/web/src/shell/AppShell.test.tsx`

**Interfaces:**

- Produces:
  ```ts
  // config/models.ts
  export const ORIGEM_PROVEDOR: Record<ProviderId, string>; // 'https://api.openai.com', 'https://generativelanguage.googleapis.com', 'https://api.anthropic.com'
  // comentário: espelha PROVIDER_ORIGINS de csp.config.js (JS lido pelo Node no check-csp; o app não tem allowJs) — paridade por teste
  // config/caminhos-codigo.json  { "adaptadores": "apps/web/src/ai/providers", "piiBr": "packages/pii-br/src", "csp": "apps/web/csp.config.js" }  (o Task 8 acrescenta "deploy")
  // config/site.ts — acréscimos
  export const SITE: { /* …atuais… */ demo: 'https://madcrow69.github.io/lavra-ata/' };
  import caminhos from './caminhos-codigo.json';
  export const CAMINHOS_CODIGO = caminhos as Readonly<typeof caminhos>; // tipado pelo JSON: `deploy` entra no tipo sozinho no Task 8
  export function refDoCodigo(commit?: string): string; // 'main' quando commit === COMMIT_DESENVOLVIMENTO
  export function urlDoCodigo(caminho: string, commit?: string): string; // `${SITE.repositorio}/${blob|tree}/${ref}/${caminho}` — `blob` se o último segmento tem extensão, senão `tree`
  export function urlDoCommit(commit: string): string; // `${SITE.repositorio}/commit/${commit}` (o Footer passa a usar)
  // features/privacidade/ComoVerificar.tsx
  export const TITULO_COMO_VERIFICAR = 'Privacidade: como verificar';
  export function ComoVerificarModal(p: {
    aberto: boolean;
    onFechar: () => void;
    commit?: string;
  }): JSX.Element;
  // shell/Header.tsx
  export interface HeaderProps {
    onConfigurarChaves: () => void;
    onVerExemplo?: () => void;
  } // o Task 6 liga onVerExemplo
  ```
- Cabeçalho, nesta ordem (spec 7.1): `Ver exemplo` (Task 6) · `Privacidade: como verificar` · botão de chaves (texto atual) · `GitHub ↗`. O modal é estado do próprio `Header`: o foco volta ao botão que o abriu.
- Conteúdo do modal (texto fixo, seções com `h3`; caminhos e hosts vêm das constantes):
  1. **"O que sai do navegador"** — "Somente as chamadas aos provedores de IA que você cadastrou, na ordem da sua lista, com a transcrição já mascarada. Nenhum servidor do Lavra recebe nada. Os únicos endereços permitidos são:" + lista com o host de cada `ORIGEM_PROVEDOR` (`new URL(o).host`).
  2. **"Confira na aba Rede"** — lista ordenada: "Abra as ferramentas do desenvolvedor: F12 ou Ctrl+Shift+I (no Mac, Cmd+Option+I)." · "Vá à aba Rede (Network) e recarregue a página." · "Filtre por Fetch/XHR." · "Gere uma ata: só aparecem chamadas a {hosts unidos por “, ” e “ou”}, na ordem da sua lista." · "Abra a chamada e veja o conteúdo enviado (Payload): no lugar de CPF, telefone e e-mail aparecem marcadores como [CPF_1]."
  3. **"Confira a política de segurança (CSP)"** — "Na aba Elementos, dentro de <head>, a tag <meta http-equiv=\"Content-Security-Policy\"> lista os destinos permitidos em connect-src. O próprio navegador bloqueia qualquer outro." + `LinkExterno` "Definição da CSP no código" → `urlDoCodigo(CAMINHOS_CODIGO.csp, commit)`.
  4. **"Confira o código desta versão"** — publicado: "Este site foi publicado pelo GitHub Actions a partir do commit {sha 7}." com link `urlDoCommit`; desenvolvimento: "Versão de desenvolvimento: os links abaixo apontam para a branch main." Links: "Adaptadores de IA (as chamadas aos provedores)" → `adaptadores`; "Biblioteca @lavra/pii-br (detecção e máscara)" → `piiBr`; "Workflow que publica o site" → `deploy`. Mais: "O site publicado fica em {SITE.demo}."
  5. **"O que não é protegido"** — "Nomes de pessoas não são mascarados — a ata precisa deles." · "Informação sensível escrita em linguagem natural (um diagnóstico, um endereço, uma opinião) vai como está." · "O que é enviado fica sob os termos do provedor que você escolheu." · "Uma extensão do navegador com acesso à página pode ler a chave e o texto." · "O modo exemplo não chama nenhum provedor: o exemplo já vem pronto no site."

- [ ] **Step 1: Testes que falham**
  - `site.test.ts`: `urlDoCodigo('a/b', 'dev')` = `https://github.com/MadCrow69/lavra-ata/tree/main/a/b`; com SHA de 40 hex → `/tree/<sha>/a/b`; `urlDoCodigo('a/c.js', sha)` → `/blob/<sha>/a/c.js`; `urlDoCommit` com `/commit/`.
  - `scripts/caminhos-codigo.test.ts`: lê `src/config/caminhos-codigo.json` e, para **cada** entrada (varre o objeto, não uma lista fixa), o caminho existe na raiz do repositório (`existsSync`); piso de sanidade ≥ 3 entradas. A entrada `deploy` e o link "Workflow que publica o site" entram só no Task 8, junto com o `deploy.yml` (o piso sobe para 4 lá); neste task o modal mostra os outros dois links de código.
  - `config/models.test.ts` (novo): lê `../../csp.config.js?raw` (padrão `?raw` de `base-legal.test.ts`) e extrai as URLs do array `PROVIDER_ORIGINS`; ordenadas, = `Object.values(ORIGEM_PROVEDOR)` ordenado. (Fica em `src/` e não em `scripts/csp-verify.test.ts`: o `tsconfig.node` é `composite` e não inclui `src/`, então importar `config/models.ts` de lá daria TS6307; o `tsconfig.app` não tem `allowJs` para importar o `.js`.)
  - `ComoVerificar.test.tsx`: botão "Privacidade: como verificar" do cabeçalho abre `dialog` com esse nome; os três hosts aparecem; com `commit` de 40 hex o texto tem os 7 primeiros caracteres e o link `href` = `urlDoCommit(sha)`; o link "Adaptadores de IA…" aponta para `/tree/<sha>/apps/web/src/ai/providers`; com `'dev'`, "Versão de desenvolvimento…" e links em `/tree/main/`; contém "Nomes de pessoas não são mascarados"; Esc fecha e o foco volta ao botão.
  - `AppShell.test.tsx`: o teste "não oferece botões de funções que ainda não existem" perde a afirmação de ausência de `/Privacidade/` (mantém a de `/Ver exemplo/` até o Task 6) e passa a afirmar a ordem das ações no `nav` "Ações do cabeçalho": "Privacidade: como verificar", botão de chaves, "GitHub".
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** typecheck + testes → PASS.
- [ ] **Step 5: Commit** — `feat(web): adiciona a página "Privacidade: como verificar" no cabeçalho`

---

### Task 4: Dados dos exemplos (4 tipos, carga sob demanda)

**Files:**

- Create: `apps/web/src/exemplos/tipos.ts`, `apps/web/src/exemplos/ficticios.ts`, `apps/web/src/exemplos/logo-exemplo.svg`, `apps/web/src/exemplos/dados/exemplo-corporativa.ts`, `exemplo-cipa.ts`, `exemplo-condominio.ts`, `exemplo-socios-ltda.ts`, `apps/web/src/exemplos/carregar.ts`, `apps/web/src/exemplos/exemplos.test.ts`
- Modify: `apps/web/scripts/bundle-verify.mjs` (marcador), `apps/web/scripts/bundle-verify.test.ts`
- Test: os dois acima

**Interfaces:**

- Consumes: `ATA_TYPES`, `obterTipo`, `camposFaltando` (registry); `construirDocumento`, `contarPreencher` (`document/build-model.ts`); `schemaDaAta` (`generation/output-schema.ts`); `validarSchema` (`ai/json-schema.ts`); `normalizarResultado` (`generation/normalize.ts`); `mask` de `@lavra/pii-br`; `salvarRascunho`/`carregarRascunho`.
- Produces:
  ```ts
  // exemplos/tipos.ts
  export interface SaidaExemplo {
    secoes: Record<string, Bloco[]>;
    encaminhamentos: Encaminhamento[];
  } // formato da saída da IA
  export interface Exemplo {
    tipoId: string;
    dados: Record<string, string>;
    pauta: string[];
    participantes: Participante[]; // ids fixos `exemplo-<tipoId>-NN`
    transcricao: string;
    saida: SaidaExemplo;
    logoSvg: string; // de `../logo-exemplo.svg?raw`
  }
  // exemplos/carregar.ts
  export type CarregadoresExemplo = Record<string, () => Promise<Exemplo>>;
  export const CARREGADORES_EXEMPLO: CarregadoresExemplo; // um import('./dados/exemplo-<tipo>').then((m) => m.exemplo) por tipo
  // cada dados/exemplo-<tipo>.ts: `export const exemplo: Exemplo`
  // tipoId sem carregador → ErroExemplo
  export const MENSAGEM_ERRO_EXEMPLO =
    'Não foi possível carregar o exemplo. Verifique a conexão e recarregue a página.';
  export class ErroExemplo extends Error {} // message = MENSAGEM_ERRO_EXEMPLO; nunca carrega o erro original
  export async function carregarExemplo(
    tipoId: string,
    carregadores?: CarregadoresExemplo,
  ): Promise<Exemplo>;
  export function rascunhoDoExemplo(ex: Exemplo): AtaDraft;
  // versao 1, tom 'formal', cópias de dados/pauta/participantes, mapa null,
  // resultado = { ...normalizarResultado(ex.saida, obterTipo(ex.tipoId)), atribuicao: {}, avisos: {}, editadas: [] }
  // exemplos/ficticios.ts — fonte única dos identificadores fictícios usados nas transcrições
  export const CPF_EXEMPLO = '529.982.247-25';
  export const CPF_EXEMPLO_2 = '111.444.777-35';
  export const TELEFONE_EXEMPLO = '(11) 98888-7777';
  export const CNPJ_EXEMPLO = '11.222.333/0001-81';
  export const CNPJ_ALFANUMERICO_EXEMPLO = '12.ABC.345/01DE-35';
  ```
- Conteúdo (escrito do zero; transcrição de 15–30 falas "Nome: fala", como a conversão do `.vtt`; cada uma cita **`CPF_EXEMPLO`** (o marcador do bundle e o `[CPF_1]` do E2E) e **`TELEFONE_EXEMPLO`**, em contexto natural; `CPF_EXEMPLO_2` é opcional):

  | Tipo          | Organização (exata)                 | Data         | Pinos                                                                                                                                                                                                                                                                                |
  | ------------- | ----------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | `corporativa` | Exemplo Tecnologia Ltda.            | `2026-10-14` | assunto "Planejamento do lançamento do aplicativo de agendamento"; 14h00–15h10, remota, videoconferência; 6 participantes (1 ausência justificada); todas as 6 seções com conteúdo (riscos incluído); 4 encaminhamentos para 3 pessoas + 1 "A definir"; **zero** `[PREENCHER`        |
  | `cipa`        | Metalúrgica Exemplo Ltda.           | `2026-10-08` | ordinária, gestão "2026/2027", nº 7, presencial; 8 participantes com representação e condição; quase-acidente na prensa, inspeção, campanha contra assédio; deliberações "por consenso" **ditas** na transcrição; zero `[PREENCHER`                                                  |
  | `condominio`  | Condomínio Edifício Exemplo         | `2026-10-15` | AGE, segunda convocação, edital `2026-10-01`, presencial, CNPJ `CNPJ_EXEMPLO`; 12 condôminos com unidade e vínculo (fração em alguns); assinatura só da mesa; item 1 com votos declarados na fala; item 2 **sem** resultado dito → exatamente um `[PREENCHER: resultado da votação]` |
  | `socios-ltda` | Exemplo Comércio de Alimentos Ltda. | `2026-10-20` | reunião, presencial, CNPJ `CNPJ_ALFANUMERICO_EXEMPLO`, convocação "Dispensada: todos os sócios presentes", participação em %, 3 sócios 50/30/20 todos presentes, declaração de formalidades marcada; votos como declarados; zero `[PREENCHER`                                        |

- `logo-exemplo.svg`: marca geométrica neutra (só `<svg>`, `<rect>`, `<circle>`, `<path>` com `fill`), com `xmlns="http://www.w3.org/2000/svg"` (sem ele, SVG carregado como imagem não desenha) e `viewBox` largo (~240×64), **sem** texto, `<style>`, `<script>`, `href` ou atributo `on…`.
- Marcador de carga (D12), em `scripts/bundle-verify.mjs`: novo `export const MARCADORES_EXEMPLO = Object.freeze(['529.982.247-25'])` ("CPF fictício presente só nos dados do modo exemplo — `src/exemplos/ficticios.ts`") e `MARCADORES_SOB_DEMANDA = [...os 3 atuais, ...MARCADORES_EXEMPLO]`; comentário do topo e mensagem de erro generalizados: "`<arquivo>` contém `<marcador>`: um módulo sob demanda (PDF/DOCX, fontes ou dados dos exemplos) entrou na carga inicial".

- [ ] **Step 1: Testes que falham**
  - `exemplos.test.ts` (`it.each(Object.keys(ATA_TYPES))` — varre o registro, não uma lista própria):
    - existe carregador; `(await carregarExemplo(id)).tipoId === id`; carregador que rejeita → `ErroExemplo` com `MENSAGEM_ERRO_EXEMPLO` e sem o texto original; `carregarExemplo('xyz')` → `ErroExemplo`.
    - `camposFaltando(rascunhoDoExemplo(ex), obterTipo(id))` = `[]`.
    - `validarSchema(ex.saida, schemaDaAta(tipo))` = `[]`; `Object.keys(ex.saida.secoes)` ⊆ chaves de `tipo.secoes`; pelo menos 3 seções com blocos; ≥ 2 encaminhamentos.
    - `ex.transcricao` contém `CPF_EXEMPLO` e `TELEFONE_EXEMPLO`; `mask(ex.transcricao)` acha ≥ 1 `CPF` e ≥ 1 `TELEFONE` (a prévia de privacidade tem o que mostrar).
    - ids de participante únicos e com prefixo `exemplo-${id}-`; nomes únicos.
    - lacunas no **documento inteiro** (preâmbulo, cabeçalho e fecho também geram lacuna): `contarPreencher(construirDocumento(rascunhoDoExemplo(ex), tipo))` = `{ corporativa: 0, cipa: 0, condominio: 1, 'socios-ltda': 0 }[id]`; no condomínio, o texto do resultado contém `[PREENCHER: resultado da votação]`.
    - **nada calculado nem inventado:** para cada ocorrência de `/qu[óo]rum|un[âa]nim|maioria|consenso|\d+\s+votos?/i` no texto do resultado, a transcrição contém o mesmo termo (sem caixa).
    - `salvarRascunho(r)` + `carregarRascunho()` devolve igual a `r` (passa na validação do rascunho; limpar a sessão no `afterEach`).
    - `logoSvg` começa com `<svg`, contém `xmlns="http://www.w3.org/2000/svg"` e `viewBox`, e não casa `/<script|<style|<text|href|\son\w+=/i`.
  - `bundle-verify.test.ts`: o `toEqual` de `MARCADORES_SOB_DEMANDA` passa a incluir `...MARCADORES_EXEMPLO`; o `it.each` da mensagem por marcador cobre o marcador novo com o texto generalizado; todo arquivo de `src/exemplos/dados/` (varredura do diretório, piso ≥ 4) importa de `../ficticios`; `ficticios.ts` contém cada item de `MARCADORES_EXEMPLO`.
- [ ] **Step 2:** FAIL → **Step 3:** escrever os quatro exemplos e o carregador → **Step 4:** typecheck + testes → PASS; `pnpm --filter @lavra/web build` → PASS com `check-bundle` (registrar no relatório o tamanho dos chunks `exemplo-*`).
- [ ] **Step 5: Commit** — `feat(web): adiciona exemplos fictícios dos quatro tipos de ata`

---

### Task 5: Fumaça de PDF e DOCX dos exemplos (spec 7.8)

**Files:**

- Create: `apps/web/src/exemplos/fumaca-exportacao.test.ts` (`// @vitest-environment node`)

**Interfaces:**

- Consumes: `carregarExemplo`, `rascunhoDoExemplo` (Task 4); `construirDocumento` (com `destaque`, Task 1); `gerarPdf`, `gerarDocx`, `caracteresSemFonte`; `unpdf.extractText`; `xmlDoDocx`; `textosDoDocumento`.

- [ ] **Step 1: Teste** — `it.each(Object.keys(ATA_TYPES))`: monta `modelo = construirDocumento(rascunhoDoExemplo(ex), tipo)` (sem logo: o Node não tem canvas) e
  - `caracteresSemFonte(modelo)` = `[]` (o exemplo nunca abre o aviso de caractere sem fonte);
  - `gerarPdf(modelo)` resolve; bytes começam com `%PDF-`; o texto extraído (espaços normalizados) contém `modelo.titulo`, o nome do primeiro participante, o título da primeira seção gerada, a ação do primeiro encaminhamento, "Página 1 de" e o início de `AVISO_MINUTA` (primeiros 40 caracteres);
  - `gerarDocx(modelo)` resolve; `word/document.xml` contém os mesmos textos (todos sem `&`, `<` ou `>`, de propósito);
  - com `construirDocumento(…, null, 'vinho')`, PDF e DOCX também resolvem.
  - Valores esperados **derivados do modelo**, nunca literais repetidos.
- [ ] **Step 2:** rodar → deve passar de primeira (é fumaça sobre código dos Tasks 1 e 4); se falhar, a correção volta ao task de origem com teste unitário junto.
- [ ] **Step 3: Commit** — `test(web): gera PDF e DOCX de cada exemplo como teste de fumaça`

---

### Task 6: Modo exemplo na bancada

**Files:**

- Create: `apps/web/src/features/exemplo/ModoExemplo.tsx`, `apps/web/src/features/exemplo/EscolherExemplo.tsx`, `apps/web/src/features/exemplo/BannerExemplo.tsx`, `apps/web/src/features/exemplo/exemplo.module.css`, `apps/web/src/exemplos/sessao.ts`, `apps/web/src/features/exemplo/modo-exemplo.test.tsx`, `apps/web/src/exemplos/sessao.test.ts`
- Modify: `apps/web/src/config/storage-keys.ts` (`EXEMPLO = 'lavra:exemplo:v1'`, `sessionStorage`, formato `{ versao: 1, tipoId }`), `apps/web/src/domain/draft.ts` + `draft-reducer.ts` (ação `substituirRascunho`), `apps/web/src/shell/Header.tsx` (botão "Ver exemplo"), `apps/web/src/shell/AppShell.tsx` (props `onVerExemplo` e `aviso?: ReactNode`, renderizado logo abaixo do cabeçalho, visível nas duas abas), `apps/web/src/features/workbench/Workbench.tsx` (`temConteudo` sai do arquivo e vai para `domain/draft-reducer.ts`, exportada e reusada pelo seletor — nunca copiada; o `novaAta` vira um núcleo `reiniciar()` sem toast, chamado por "Nova ata" e por "Começar a minha", cada um com o seu toast), `apps/web/src/features/form/TipoBlock.tsx` (rádios desabilitados no modo exemplo), `apps/web/src/features/form/GenerateBar.tsx`, `apps/web/src/features/preview/SectionActions.tsx`, `apps/web/src/features/preview/A4Preview.tsx` (logo efetiva)
- Test: `apps/web/src/domain/draft-reducer.test.ts`, `apps/web/src/features/form/GenerateBar.test.tsx`, `apps/web/src/features/preview/section.test.tsx`, `apps/web/src/shell/AppShell.test.tsx` (remove a última afirmação de ausência, de `/Ver exemplo/`, e afirma a ordem completa `Ver exemplo` · `Privacidade: como verificar` · chaves · `GitHub` passando `onVerExemplo`)

**Interfaces:**

- Consumes: `CARREGADORES_EXEMPLO`, `carregarExemplo`, `rascunhoDoExemplo`, `ErroExemplo`, `MENSAGEM_ERRO_EXEMPLO` (Task 4); `prepararLogo` (`logo/rasterizar-logo.ts`); `useOperacaoIA().interromper`; `Modal`, `Button`, `useToast`; `ATA_TYPES`.
- Produces:
  ```ts
  // domain/draft.ts — DraftAction ganha
  | { type: 'substituirRascunho'; rascunho: AtaDraft }
  // exemplos/sessao.ts
  export function lerExemploDaSessao(): string | null;          // tipoId ou null; nunca lança; via storageOuNulo('session')
  export function gravarExemploNaSessao(tipoId: string | null): void; // null apaga; nunca lança
  // domain/draft-reducer.ts
  export function temConteudo(d: AtaDraft): boolean; // movida do Workbench, mesma regra
  // features/exemplo/ModoExemplo.tsx
  export const MOTIVO_EXEMPLO = 'No exemplo, nada é enviado para IA. Para gerar com a sua chave, clique em “Começar a minha”.';
  export const MOTIVO_TIPO_NO_EXEMPLO = 'Para ver outro tipo, use “Ver exemplo”; para a sua ata, “Começar a minha”.';
  export interface EstadoExemplo { tipoId: string | null; logo: LogoDoc | null }
  export function ModoExemploProvider(p: { valor: EstadoExemplo; children: ReactNode }): JSX.Element;
  export function useModoExemplo(): EstadoExemplo; // fora do provider: { tipoId: null, logo: null }
  // features/workbench/Workbench.tsx
  export interface WorkbenchProps { /* …atuais… */ exemplos?: CarregadoresExemplo }
  ```
- Mapa de uso (gate 1):
  - **Entrada:** botão "Ver exemplo" (primeiro do cabeçalho) → modal "Ver um exemplo" com o texto "Um exemplo completo, com dados e pessoas fictícios e a ata já gerada. Nada é enviado para IA." e um botão por tipo de `ATA_TYPES` (nome acessível = `tipo.rotulo`; `tipo.descricao` por `aria-describedby`). Com `temConteudo(state)` e fora de um exemplo intacto: "O rascunho desta aba (dados, participantes, transcrição e ata gerada) será substituído pelo exemplo. A sua logo é mantida."; com `operacao !== null`, também "A geração em andamento será cancelada."
  - **Carregando:** o botão escolhido com `aria-busy` e texto "Carregando…", os outros desabilitados; fechar o modal descarta o carregamento (sem troca, sem toast). Falha → `role="alert"` com `MENSAGEM_ERRO_EXEMPLO` no modal; rascunho intacto.
  - **Sucesso:** `interromper()` → `dispatch({ type: 'substituirRascunho', … })` → `rodada + 1` (remonta formulário e folha) → modo exemplo ligado (`base` = o rascunho carregado) → `gravarExemploNaSessao(tipoId)` → aviso "Rascunho recuperado" some → aba "Documento" → toast `Exemplo carregado: ${tipo.rotulo}. Nada foi enviado para IA.` A logo do exemplo é rasterizada em seguida (`prepararLogo(new File([ex.logoSvg], 'logo-exemplo.svg', { type: 'image/svg+xml' }))`, injetável como `logo.processar` nos testes); falha = sem logo, silenciosa.
  - **Banner** (`aviso` do `AppShell`, `section` com `aria-label="Modo exemplo"`): "Você está vendo um exemplo — nada foi enviado para IA." + linha menor `Exemplo: ${tipo.rotulo}. Dados e pessoas fictícios.` + botão primário "Começar a minha".
  - **Bloqueio de IA:** `GenerateBar` (`podeGerar` falso; `MOTIVO_EXEMPLO` num `p` ligado por `aria-describedby`; precede a falta de campos) e `SectionActions` (motivo `MOTIVO_EXEMPLO` antes de `MOTIVO_SEM_CHAVE`; Regerar e Ajustar parados; editar à mão livre). Exportar e copiar tarefas seguem livres.
  - **Tipo travado (ruling B2):** no modo exemplo, os rádios de tipo do `TipoBlock` ficam `disabled` com `MOTIVO_TIPO_NO_EXEMPLO` num `p` ligado por `aria-describedby` (mesmo padrão do `MOTIVO_IA_OCUPADA` já usado ali); assim a marca de sessão nunca diverge do `tipoId` do rascunho.
  - **Logo efetiva na folha:** `logo ?? (modo.tipoId !== null ? modo.logo : null)` — a da pessoa vence.
  - **Saída:** "Começar a minha" → se `state === base`, direto; senão modal "Fechar o exemplo?" com "As alterações que você fez no exemplo serão apagadas." e ações "Cancelar" / "Apagar e começar a minha". Executa o núcleo `reiniciar()` (interromper, `novaAta`, `rodada + 1`, aba "Editar"; sem o toast do "Nova ata") + `gravarExemploNaSessao(null)` + modo desligado, e o toast `Exemplo fechado. O formulário está vazio para a sua ata; o tipo “${tipo.rotulo}” foi mantido.` "Nova ata" no modo exemplo também desliga o modo e limpa a marca.
  - **Recarregar:** na abertura, se `lerExemploDaSessao() === recuperado?.tipoId`, o modo volta ligado (`base` = o recuperado) e o aviso "Rascunho recuperado" não aparece; marca sem rascunho correspondente é apagada. A logo do exemplo, que vive só na memória, é refeita: `carregarExemplo(tipoId)` (chunk do próprio site, nenhum provedor) + `prepararLogo` do `logoSvg`; falha = sem logo, silenciosa.
  - **Preferências:** carregar exemplo não chama `definir` do `PreferenciasStore`.

- [ ] **Step 1: Testes que falham** (`modo-exemplo.test.tsx`, Workbench com `exemplos` falsos que resolvem os dados reais de `exemplo-cipa`/`exemplo-corporativa`, adaptadores espiões via `opcoesCadeia`, `logo.processar` falso):
  1. rascunho vazio → "Ver exemplo" → "CIPA — reunião ordinária ou extraordinária" → folha com "Metalúrgica Exemplo Ltda."; banner com os dois textos exatos; toast exato; nenhum adaptador chamado.
  2. com chave configurada → "Gerar ata" desabilitado e `aria-describedby` apontando para `MOTIVO_EXEMPLO`; "Regerar" de uma seção desabilitado com o mesmo motivo; "Baixar PDF" habilitado.
  3. rascunho com transcrição digitada → modal mostra o aviso de substituição; após escolher, o campo "Transcrição da reunião" tem a transcrição do exemplo; com o modal fechado sem escolher, nada muda.
  4. operação de IA em andamento (adaptador que não resolve) → o modal avisa o cancelamento; escolher o exemplo aborta o sinal do adaptador e, quando ele "resolve" depois, a folha continua a do exemplo.
  5. "Começar a minha" sem edição → sem modal; formulário vazio; tipo mantido; banner some; toast exato; com chave e campos preenchidos, "Gerar ata" volta a habilitar.
  6. editar um campo do exemplo → "Começar a minha" abre "Fechar o exemplo?"; "Cancelar" mantém tudo; confirmar limpa.
  7. carregador que rejeita → alerta com `MENSAGEM_ERRO_EXEMPLO`; rascunho igual ao anterior.
  8. desmontar e montar o Workbench com a mesma sessão → banner de volta, sem "Rascunho recuperado", e a logo do exemplo de volta na folha; depois de "Começar a minha", remontar → sem banner.
  9. "Nova ata" no modo exemplo → banner some e `lerExemploDaSessao()` = `null`.
  10. logo: sem logo da pessoa, a folha mostra `img` "Logo da organização" com a logo do exemplo; com logo da pessoa, mostra a dela; "Começar a minha" tira a do exemplo.
  11. preferências: com o `Workbench` envolvido por `PreferenciasProvider store={espião}` (sem prop nova), `definir` não é chamado ao carregar o exemplo.
  12. tipo travado (B2): no modo exemplo, os quatro rádios de "Tipo de ata" estão desabilitados e descritos por `MOTIVO_TIPO_NO_EXEMPLO` (texto exato visível); depois de "Começar a minha", habilitados de novo e sem o texto.
  13. toasts: "Começar a minha" mostra **só** o toast "Exemplo fechado…" (o de "Nova ata iniciada…" não aparece).
  - `sessao.test.ts`: grava/lê/apaga; `sessionStorage` que lança → `null` sem exceção; JSON com `versao: 2` → `null`.
  - `draft-reducer.test.ts`: `substituirRascunho` devolve exatamente o rascunho passado.
- [ ] **Step 2:** FAIL → **Step 3:** implementar (o estado do modo vive na `Bancada`; `ModoExemploProvider` envolve formulário e folha; o seletor reusa `Modal`) → **Step 4:** typecheck + testes → PASS (os testes existentes de GenerateBar/SectionActions/AppShell seguem verdes).
- [ ] **Step 5: Commit** — `feat(web): adiciona o modo exemplo com banner e "Começar a minha"`

---

### Task 7: E2E de fumaça do modo exemplo, da privacidade e das preferências

**Files:**

- Create: `apps/web/e2e/modo-exemplo.spec.ts`
- Modify: `apps/web/e2e/apoio.ts` (helpers `verExemplo(page, rotuloDoTipo)`; `EXEMPLOS_E2E: Record<TipoFixture, { organizacao: string; arquivo: string }>` com as organizações do Task 4 e `ata-<tipo>-<data>.pdf` — repetição inevitável, registrada em comentário: os dados importam `?raw`, que o Node do Playwright não resolve; e `abrirPagina(context, rede): Promise<Page>`, **extraído** do fixture `app` — init script de `securitypolicyviolation`, ouvintes de `pageerror`/`console`, `goto('./')` —, que o fixture passa a usar; nada copiado)
- Cores esperadas: **lidas da própria página**, não importadas — a cor computada do título da folha é comparada com o `backgroundColor` computado da amostra do rádio escolhido ("Vinho", depois "Grafite (padrão)"). O `e2e/` compila no `tsconfig.node` (projeto `composite`), que não inclui `src/`: importar `config/destaque.ts` dali daria TS6307. O prefixo `https://github.com/MadCrow69/lavra-ata/` fica **literal** no E2E: `config/site.ts` lê o global `__COMMIT_SHA__` ao carregar, que só existe no Vite/Vitest (importá-lo no Node do Playwright lança `ReferenceError`).

**Interfaces:**

- Consumes: `test`, `afirmarLimpo`, `semRolagemHorizontal`, `folha`, `baixar`, `configurarChaves`, `preencherReuniao`, `gerarAta`, `campo`, `escolherTipo`, `botaoGerar` de `apoio.ts`; textos exatos dos Tasks 2, 3 e 6.

Cenários (cada um termina com `afirmarLimpo` e `expect(rede.chamadas).toEqual([])`, salvo o 4, que gera de propósito depois de sair do exemplo):

1. **Os quatro exemplos sem rede** (`for` sobre `EXEMPLOS_E2E`, página nova a cada tipo por `abrirPagina`, com `afirmarLimpo` em cada uma): guardar `const inicio = rede.arquivosDoApp.length` ao abrir e afirmar sobre `rede.arquivosDoApp.slice(inicio)` (a lista acumula entre páginas do mesmo contexto) — antes do clique, nenhum `/assets/exemplo-<tipo>` desse tipo; `verExemplo` → banner "Você está vendo um exemplo — nada foi enviado para IA." visível; o cabeçalho da folha contém a organização e a `img` "Logo da organização" está visível (prova do SVG rasterizado); depois, o recorte tem `/assets/exemplo-<tipo>`; "Baixar PDF" (aceitando o modal de lacuna no condomínio) → `suggestedFilename()` = `arquivo`; o texto do PDF (`unpdf`) contém a organização.
2. **Chave configurada não muda nada:** `configurarChaves({ OpenAI })` → exemplo corporativo → `botaoGerar` desabilitado e o texto `MOTIVO_EXEMPLO` visível; primeiro "Regerar" desabilitado; `rede.chamadas = []`.
3. **Prévia de privacidade no exemplo:** "Ver o que vai para a IA" → `dialog` "O que vai para a IA": região "Original" contém `529.982.247-25`; região "Enviado à IA" contém `[CPF_1]` e não contém `529.982.247-25`.
4. **"Começar a minha" e gerar a sua** (num `describe` com `test.use({ cenario: { openai: 'ok' } })`, como `exportacao.spec.ts` — o padrão `openai: 'limite'` com só a chave OpenAI nunca geraria): exemplo corporativo → "Começar a minha" → toast exato; `campo(page, 'Transcrição da reunião')` vazio; banner oculto → `gerarAta` (OpenAI interceptada, fixture `ataGeradaJson` existente) → "Ata gerada por OpenAI · gpt-6-luna"; `rede.chamadas` só com hosts de provedor; CSP limpa.
5. **Privacidade:** botão "Privacidade: como verificar" → `dialog` com esse nome; os três hosts; o link "Adaptadores de IA (as chamadas aos provedores)" com `href` começando por `https://github.com/MadCrow69/lavra-ata/tree/` e terminando em `/apps/web/src/ai/providers` (o ref depende de o build ter `GITHUB_SHA`: não fixar); Esc → fechado e foco no botão.
6. **Preferências entre abas:** CIPA + tom "Conciso (cerca de metade do tamanho)" + cor "Vinho" + "Lembrar preferências neste navegador" → `abrirPagina(context, rede)` (sessão nova, mesmo `localStorage`, com a auditoria de CSP/console instalada) → rádio da CIPA marcado, tom `conciso`, `getComputedStyle` do título da folha = cor da amostra "Vinho"; `localStorage['lavra:preferencias:v1']` parseado tem só chaves de `versao, tipoId, tom, destaque, ordem, modelos` e não contém nenhum trecho da transcrição digitada antes; "Esquecer preferências" → nova página (`abrirPagina`) → "Reunião corporativa" marcado e título na cor da amostra "Grafite (padrão)". `afirmarLimpo` em **cada** página: nenhuma violação de CSP (prova da D7).
7. **360×740:** com o exemplo de condomínio carregado: `semRolagemHorizontal`; "Ver exemplo", "Privacidade: como verificar" e "Começar a minha" com `boundingBox` dentro da viewport; abrir o modal de privacidade → `scrollWidth <= clientWidth`; abas Editar e Documento funcionam com o banner visível nas duas.

- [ ] **Step 1:** helpers em `apoio.ts`; `pnpm --filter @lavra/web typecheck` → PASS; specs existentes seguem PASS.
- [ ] **Step 2:** escrever os 7 cenários → `pnpm build && pnpm --filter @lavra/web e2e` → corrigir até PASS (falha do app volta ao task de origem com teste unitário junto). Conferir que nenhum `vite preview` ficou rodando.
- [ ] **Step 3: Commit** — `test(web): adiciona E2E do modo exemplo, da privacidade e das preferências`

---

### Task 8: Deploy no GitHub Pages

**Files:**

- Create: `.github/workflows/deploy.yml`
- Modify: `apps/web/src/config/caminhos-codigo.json` (entrada `"deploy": ".github/workflows/deploy.yml"`), `apps/web/src/features/privacidade/ComoVerificar.tsx` + teste (link "Workflow que publica o site" → `urlDoCodigo(CAMINHOS_CODIGO.deploy, commit)`), `apps/web/scripts/caminhos-codigo.test.ts` (piso 4), `SECURITY.md` ("Versões suportadas": a demo é publicada a partir da `main` por `deploy.yml`, com o hash no rodapé; tira o "(planejado: o site ainda não está publicado)"; e, em "Dependências comprometidas", troca "A análise estática com CodeQL é **(planejado)**" por "O CodeQL (configuração padrão do GitHub) analisa todo PR." — não há workflow de CodeQL no repositório, é a configuração padrão; ruling S9), `CONTRIBUTING.md` (seção curta "Publicação": todo push na `main` publica; como conferir o hash)

**Interfaces:**

- Consumes: `vite.config.ts` já tem `base: '/lavra-ata/'` e `__COMMIT_SHA__` de `process.env.GITHUB_SHA` (o GitHub o define no `push`; **não** sobrescrever — variáveis `GITHUB_*` não podem ser redefinidas); `pnpm --filter @lavra/web build` (inclui `check-csp` e `check-bundle`).
- Pesquisa obrigatória (registrar no relatório, com links): versão atual e SHA de commit **do tag** (desreferenciar tag anotada: `gh api repos/<dono>/<repo>/git/ref/tags/<tag>` e, se `object.type == "tag"`, `gh api repos/<dono>/<repo>/git/tags/<sha>`) de `actions/configure-pages`, `actions/upload-pages-artifact` e `actions/deploy-pages` (referência da spec 11: v6, v5, v5 — confirmar), e o exemplo oficial atual de deploy de site estático (https://docs.github.com/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). `checkout`, `pnpm/action-setup` e `setup-node` reusam **os mesmos SHAs** de `ci.yml` (o Dependabot atualiza todos juntos).
- Permissões de Pages (pesquisado em 22/10/2026, ruling B1): o `actions/configure-pages` chama `GET /repos/{dono}/{repo}/pages` (`getPagesSite` em `src/api-client.js`, sem `enablement` → falha se o Pages não existir ou não usar workflow) e essa rota exige a permissão **Pages: read** (https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps — "`GET /repos/{owner}/{repo}/pages` | read"). Com só `contents: read` o job `build` falharia — e só depois do merge. O exemplo oficial (https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) dá `contents: read, pages: write, id-token: write` ao workflow inteiro; aqui fica o mínimo por job. O `deploy-pages` exige "no mínimo `pages: write` e `id-token: write`" (mesma página) e o ambiente `github-pages`.
- Forma do workflow (decidida; o job `build` roda também no PR, sem publicar, para toda falha de build, de Pages ou de artefato aparecer **antes** do merge):

  ```yaml
  name: Deploy
  on:
    push:
      branches: [main]
    pull_request:
    workflow_dispatch:
  permissions:
    contents: read
  concurrency:
    group: pages-${{ github.ref }} # na main, um grupo só; cada PR no seu
    cancel-in-progress: ${{ github.event_name == 'pull_request' }} # nunca cortar uma publicação em andamento
  jobs:
    build: # timeout-minutes: 15
      # permissions: { contents: read, pages: read }   ← pages: read para o configure-pages (B1)
      # checkout (persist-credentials: false) → pnpm/action-setup → setup-node (node-version-file: .nvmrc, SEM cache: D10)
      # → pnpm install --frozen-lockfile → pnpm --filter @lavra/web build
      # → actions/configure-pages → actions/upload-pages-artifact (path: apps/web/dist; retention-days curto se a versão atual aceitar)
    deploy: # needs: build; timeout-minutes: 10
      # if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
      # permissions: { pages: write, id-token: write }
      # environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }
      # actions/deploy-pages (id: deployment)
  ```

  Comentários do arquivo em pt-BR, no estilo de `ci.yml`. Nenhum segredo, nenhuma entrada de usuário interpolada em `run:`. Consequência: o Pages precisa estar habilitado com `build_type=workflow` **antes** do primeiro push do PR (Task 10, Step 4); sem isso o `build` do PR falha no `configure-pages` — o que é o comportamento desejado (falha visível antes do merge).

- [ ] **Step 1:** pesquisar e anotar versões/SHAs (e reconfirmar na doc atual a permissão do `configure-pages`; se a doc mudou, registrar e ajustar só o job `build`); escrever `deploy.yml`.
- [ ] **Step 2: Verificação local da injeção do hash** — `GITHUB_SHA=0123456789abcdef0123456789abcdef01234567 pnpm --filter @lavra/web build` → PASS; `grep -rl 0123456789abcdef0123456789abcdef01234567 apps/web/dist/assets` acha o chunk do rodapé; `dist/index.html` referencia `/lavra-ata/assets/`. Rebuild sem a variável depois (o `dist` local não fica com hash falso).
- [ ] **Step 3: Verificação estática** — todo `uses:` do arquivo casa `@[0-9a-f]{40} # v\d` (grep); `permissions`: topo `contents: read`, `build` `contents: read` + `pages: read`, `deploy` `pages: write` + `id-token: write`, nada além; o `deploy` tem o `if` que o tira do PR; se `actionlint` existir na máquina, rodar e anexar a saída (senão declarar "não verificado por actionlint"). Testes (`caminhos-codigo.test.ts` com 4 entradas) → PASS.
- [ ] **Step 4: Commit** — `ci: publica o site no GitHub Pages a partir da main`
- Não é passo do implementador: habilitar o Pages, o run do PR e o primeiro deploy (Task 10, controlador).

---

### Task 9: GIF, README em pt-BR e em inglês

**Files:**

- Create: `apps/web/playwright.gif.config.ts`, `apps/web/gif/demo.spec.ts`, `apps/web/scripts/video-para-gif.mjs`, `apps/web/scripts/video-para-gif.test.ts`, `docs/demo.gif`, `README.en.md`, `apps/web/src/config/readme.test.ts`
- Modify: `apps/web/playwright.config.ts` (exporta `configBase`), `apps/web/package.json` (script `"gif": "playwright test -c playwright.gif.config.ts && node scripts/video-para-gif.mjs"`), `apps/web/tsconfig.node.json` (`include` ganha `playwright.gif.config.ts` e `gif`), `README.md` (reescrito), `CONTRIBUTING.md` (comando `pnpm --filter @lavra/web gif`, ffmpeg necessário, `FFMPEG` para apontar o executável, orçamento de 3 MB)

**Interfaces:**

- Produces:
  ```js
  // scripts/video-para-gif.mjs
  export const ORCAMENTO_GIF_BYTES = 3_000_000;
  export const OPCOES_GIF = Object.freeze({ fps: 10, largura: 960, cores: 128 });
  /** Duas passadas do ffmpeg: [argsPaleta, argsGif]. Arrays para execFileSync (nunca shell). */
  export function argumentosFfmpeg(entrada, paleta, saida, opcoes = OPCOES_GIF); // → [string[], string[]]
  // filtros: `fps=${fps},scale=${largura}:-1:flags=lanczos,palettegen=max_colors=${cores}:stats_mode=diff`
  //          `fps=${fps},scale=${largura}:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`
  // main (só sob a guarda de CLI já usada em scripts/gerar-cobertura-fontes.mjs:
  //   process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href — importar no teste não roda nada):
  // o .webm mais novo em apps/web/test-results/gif/ → docs/demo.gif (raiz do repo); executável = process.env.FFMPEG ?? 'ffmpeg';
  // execFileSync sem `shell: true`;
  // acima do orçamento → exit 1 com "O GIF tem {x} MB e o orçamento é 3 MB: reduza fps, largura ou duração."
  ```
- `playwright.config.ts` passa a exportar `configBase(porta: number)` (o `webServer`, o `baseURL` e o `use` comuns; o `export default` segue com a porta 4391, sem mudança de comportamento) e `playwright.gif.config.ts` o reusa com a porta 4392 (sem copiar o `webServer`) e acrescenta `testDir: './gif'`, `outputDir: 'test-results/gif'`, `workers: 1`, `use: { viewport: { width: 1280, height: 720 }, video: { mode: 'on', size: { width: 1280, height: 720 } }, launchOptions: { slowMo: 250 } }` (conferir os nomes atuais das opções na doc do Playwright 1.64).
- `gif/demo.spec.ts` (usa `test` de `../e2e/apoio`): abrir → pausa → "Ver exemplo" → "Reunião corporativa" → folha preenchida (pausa ~1,5 s) → aba Editar visível no desktop → "Ver o que vai para a IA" → lado a lado (pausa ~2,5 s) → fechar → "Baixar PDF" → toast "PDF baixado" (pausa ~1,5 s) → `afirmarLimpo` e `rede.chamadas = []`. Pausas em constantes nomeadas no topo do arquivo. Duração alvo ≤ 20 s.
- README.md (pt-BR, ordem da spec 12): título + uma frase do que é · link "[English](README.en.md)" · GIF `docs/demo.gif` com `alt` descritivo · **"Experimente: https://madcrow69.github.io/lavra-ata/"** ("Ver exemplo" não pede chave) · "Como funciona" (o atual, enxuto) · **"Privacidade: como verificar"** (mesmo conteúdo do modal: o que sai, passo a passo do DevTools, CSP, links do código — adaptadores, `pii-br`, `csp.config.js`, `deploy.yml` —, hash no rodapé, o que não é protegido) · "Tipos de ata e base legal" (o atual) · "Rodar localmente" (`pnpm install`, `pnpm --filter @lavra/web dev`, `pnpm test`, build + preview) · "Arquitetura" (monorepo `apps/web` + `packages/pii-br`, fluxo da spec 5.2 em 5 linhas, sem backend, CSP, exportação local) · **"Limitações"** (nomes não mascarados; toda ata é minuta; chamada direta à OpenAI pelo navegador funciona mas não é oficialmente suportada e já quebrou antes; adaptador da Anthropic não verificado com chamada real; tipografia do DOCX depende das fontes do Word/LibreOffice; o que foi e não foi conferido visualmente no PDF/DOCX — mantendo a precisão do texto atual) · "Roadmap" (contratos, transcrição de áudio, S.A. e conselho de administração, interface em inglês, `pii-br` no npm) · "Documentação" (lista atual) · "Licença" MIT · "Feito por [Diego Antunes](https://www.linkedin.com/in/diego-ozorio-antunes/)". Remove o "Status: em construção" e o "a publicação do site (demo) ainda está no roteiro".
- README.en.md: tradução fiel das mesmas seções ("Privacy: how to verify" etc.), link "[Português](README.md)", mesmos links e GIF; nomes de botões citados em pt-BR entre aspas com a tradução entre parênteses na primeira vez (a interface é só em pt-BR).

- [ ] **Step 1: Testes que falham**
  - `video-para-gif.test.ts`: `argumentosFfmpeg('a.webm', 'p.png', 'o.gif')` → primeira lista contém `-i`, `a.webm` e o filtro `palettegen=max_colors=128:stats_mode=diff`; segunda contém as duas entradas e `paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, termina em `o.gif`; com `{ fps: 8, largura: 800, cores: 64 }` os números mudam; o grafo de filtro da segunda passada é **um único** elemento do array (prova só do formato do argumento; a ausência de shell é garantida por `execFileSync` sem `shell: true`, conferida na revisão); importar o módulo no teste não chama o ffmpeg (guarda de CLI).
  - `readme.test.ts` (`README.md?raw` e `README.en.md?raw`, como `base-legal.test.ts`): cada um contém `SITE.linkedin`, `SITE.demo`, `docs/demo.gif`, o host de cada `ORIGEM_PROVEDOR`, o link para o outro idioma e, para cada valor de `CAMINHOS_CODIGO` (varredura do objeto), o caminho; o pt-BR contém o título "Privacidade: como verificar", o inglês "Privacy: how to verify".
- [ ] **Step 2:** FAIL → implementar script, config e spec → **Step 3:** `pnpm build && pnpm --filter @lavra/web gif` → `docs/demo.gif` ≤ 3 MB (registrar tamanho, duração e fps no relatório; abrir o GIF e conferir os três momentos: exemplo, lado a lado, toast do PDF). Conferir que preview e navegador da gravação foram encerrados.
- [ ] **Step 4:** escrever README.md e README.en.md → `readme.test.ts` PASS; `pnpm format:check` PASS (markdown).
- [ ] **Step 5: Commit** — `docs: reescreve o README com GIF, demo e como verificar a privacidade` (inclui `README.en.md`, o GIF e o script; se preferir dois commits, `build(web): grava o GIF de demonstração com Playwright` antes).

---

### Task 10: Gate final, prova de uso narrada, PR e publicação

- [ ] **Step 1 (ux-ui-defensive gate 3):** com `pnpm build` + `pnpm --filter @lavra/web preview`, narrar no relatório, **começando pela URL inicial com o rascunho vazio** (fora das superfícies novas): (a) visitante sem chave: cabeçalho → "Ver exemplo" → cada um dos 4 tipos → banner → folha com logo do exemplo, preâmbulo/fecho/avisos do tipo e, no condomínio, a lacuna → "Ver o que vai para a IA" → "Baixar PDF" e "Baixar DOCX" → abrir o PDF no visualizador do navegador (capturar 1ª página de cada tipo) → "Começar a minha"; (b) com volume: depois de "Começar a minha", colar 200 participantes e uma transcrição longa (helpers dos E2E existentes), gerar com provedor interceptado e conferir que nada do exemplo sobrou; (c) "Privacidade: como verificar" → seguir o próprio passo a passo no DevTools do navegador (aba Rede durante o exemplo: só arquivos do app; durante a geração interceptada: só o host do provedor) → clicar cada link do modal (abrem o GitHub na ref certa); (d) cor de destaque + "Lembrar preferências" → nova aba → "Esquecer preferências"; (e) F5 no meio do exemplo. Medir overflow em 1440 / ~1000 / 360 px (cabeçalho com quatro ações, banner, modal de privacidade). Navegador do MCP de DevTools se livre; senão Playwright headless; capturas no scratchpad. Encerrar preview e navegador.
- [ ] **Step 2:** atualizar documentação restante: `SECURITY.md` (modo exemplo sem rede e com dados embutidos no site; preferências em `localStorage` só por opção, lista fechada de campos, nunca transcrição/ata/participantes/chave; cor de destaque aplicada por CSSOM sem exceção de CSP), roteiro (linha 06 marcada como feita, se o padrão dos planos anteriores fizer isso), `CONTRIBUTING.md` (como adicionar o exemplo de um tipo novo: arquivo em `src/exemplos/dados/`, o teste reprova tipo sem exemplo).
- [ ] **Step 3:** gate completo — `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci` (teto de workers do próprio script), `pnpm build` (com `check-csp` e `check-bundle`; registrar carga inicial e chunks `exemplo-*`), `pnpm --filter @lavra/web e2e`; `grep` por nomes de terceiros (lista da memória do projeto), por CPF/CNPJ que não sejam os fictícios e por caracteres invisíveis/bidi literais; commit `docs: documenta o modo exemplo, as preferências e a publicação`.
- [ ] **Step 4 (controlador):** habilitar o Pages com publicação por workflow **antes do push** (`gh api -X POST repos/MadCrow69/lavra-ata/pages -f build_type=workflow`; se já existir, `-X PUT`) e conferir o ambiente `github-pages` (regra de branch: só `main`); push; PR "feat(web): modo exemplo, página de privacidade e deploy no GitHub Pages" com o template, as decisões D1–D12, o desvio da spec 7.7 (D4), os tamanhos dos chunks, o tamanho do GIF e as versões/SHAs das actions de Pages; CI verde **e** o job `build` do workflow "Deploy" verde no PR (prova de `configure-pages` + artefato antes do merge; o `deploy` aparece como pulado).
- [ ] **Step 5 (controlador):** squash merge; acompanhar o run de "Deploy" na `main` (`gh run watch`).
- [ ] **Step 6 (controlador, fumaça pós-deploy):** abrir https://madcrow69.github.io/lavra-ata/ → rodapé com "versão <7 caracteres>" igual ao commit do merge (link certo) → DevTools/Rede: só a própria origem → "Ver exemplo" → "Reunião corporativa" → "Baixar PDF" baixa `ata-corporativa-2026-10-14.pdf` → "Privacidade: como verificar" com links para o commit publicado → `<meta http-equiv="Content-Security-Policy">` presente. Falha = corrigir em PR novo (nunca editar a `main` direto).
- [ ] **Step 7 (controlador):** com a demo no ar, revisar e fazer merge do PR #4 do release-please (MVP 0.1.0) — se o PR estiver desatualizado, esperar o release-please regerá-lo após o merge do Step 5; PR aberto pelo `GITHUB_TOKEN` não dispara CI sozinho (fechar/reabrir ou rodar o CI manualmente antes do merge).
