# Plano 03 — App: bancada, ata corporativa, provedores com fallback e revisão por seção

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Frontend tasks also follow the `ux-ui-defensive` protocol (gates 1–3).

**Goal:** a pessoa preenche a bancada, cola a transcrição, vê o que vai para a IA, gera a ata **corporativa** com OpenAI, Gemini ou Anthropic (com fallback entre as chaves dela) e revisa cada seção na folha A4 em HTML.

**Architecture:** React sem biblioteca de estado (reducer + context), domínio puro em TypeScript testável sem DOM, registro de tipos de ata declarativo, adaptadores de provedor por `fetch` direto (sem SDK), cadeia de fallback sequencial, `@lavra/pii-br` entre o formulário e a IA. Nenhuma requisição além dos três provedores; CSP do Plano 01 intacta.

**Tech Stack:** React 19.3, Vite 8, TypeScript 6.0.3, Vitest 5 + Testing Library + jsdom, Playwright (E2E), CSS com tokens (sem kit de UI), fontes auto-hospedadas via `@fontsource-variable/*`.

**Spec:** `docs/superpowers/specs/2026-10-20-lavra-design.md` (seções 5, 7, 8, 9) · **Resultado do spike:** `docs/spike-conectividade.md`

**Branch/PR:** `feat/03-app-corporativa` → PR "feat(web): bancada, ata corporativa e geração com IA".

## Global Constraints

- **Sem backend.** Nenhuma requisição além de `api.openai.com`, `generativelanguage.googleapis.com`, `api.anthropic.com`. Nenhum script, fonte, CSS ou imagem de terceiros em tempo de execução. A CSP de `apps/web/csp.config.js` não muda neste plano (se uma exceção for inevitável, parar e registrar).
- **Nenhum `dangerouslySetInnerHTML`** (lint já bloqueia). A saída da IA é JSON com texto puro, renderizado como nó de texto.
- **Texto visível em pt-BR com acentuação correta.** Mensagens de erro com causa + ação.
- **Chave de API:** só em memória por padrão; `localStorage` apenas com a opção "Lembrar neste navegador" marcada pela pessoa. Nunca em URL, console, mensagem de erro, `sessionStorage` ou estado serializado do rascunho.
- **Transcrição e resultado nunca em `localStorage`**; rascunho em `sessionStorage`.
- **Datas sem `Date` com fuso:** toda data é string `AAAA-MM-DD` formatada por fatiamento.
- **Valores com mais de uma possibilidade real ficam em constante nomeada em fonte única** (`src/config/*`): modelos e parâmetros por provedor, autor/LinkedIn/repositório, limites de tamanho, chaves de storage.
- **Dados de teste fictícios** (CPF 529.982.247-25 e 111.444.777-35; CNPJ 11.222.333/0001-81; telefones `(11) 98888-7777`; nomes inventados).
- **Parâmetros de provedor verificados no spike** (fonte: `docs/spike-conectividade.md`):
  - OpenAI: `POST /v1/responses`, `text.format = { type: 'json_schema', name, strict: true, schema }`, `reasoning: { effort: 'none' }` para `gpt-6-luna`, **`store: false`**, header `Authorization: Bearer`.
  - Gemini: `POST /v1beta/models/{modelo}:generateContent`, `generationConfig.responseMimeType = 'application/json'` + `responseJsonSchema`, **sem** `thinkingConfig` (o padrão do modelo funcionou; níveis variam por modelo), header `x-goog-api-key`.
  - Anthropic (não verificado com chamada real — conta sem crédito): `POST /v1/messages`, headers `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`; `output_config: { format: { type: 'json_schema', schema }, effort: 'low' }`; sem `thinking`. Modelo padrão `claude-haiku-5-5`.
  - **Padrão de modelo = o menor/mais econômico de cada provedor** (decisão do autor); a pessoa troca no modal de chaves e a barra de geração mostra qual modelo será usado, com atalho "trocar".
  - Todas as chamadas: `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, `AbortController`.
  - Schemas compatíveis com os três: só `object`/`array`/`string`/`enum`, todo objeto com `additionalProperties: false` e todas as propriedades em `required` (sem `anyOf`, sem `minLength`).
- **Testes** com `--maxWorkers=4`; uma suíte por vez. E2E roda contra o **build** (`vite preview`), onde a CSP está ativa.

## Review Focus

1. **Chave vazando** para storage do rascunho, URL, console ou mensagem de erro: esperado nunca. Teste no Task 6 (`chave não aparece em nenhum storage nem em mensagem de erro`) e no E2E do Task 11.
2. **Resposta cortada ou JSON inválido tratado como sucesso parcial:** esperado erro tipado e fallback. Testes nos Tasks 5 e 7.
3. **Transcrição gigante** (200 mil caracteres) travando a digitação ou a prévia de privacidade: esperado contador e prévia responsivos (detecção com debounce) e geração bloqueada acima do limite com mensagem. Teste no Task 4.
4. **Assembleia com muitos participantes** (200 linhas coladas): esperado formulário utilizável e folha A4 legível. Teste de volume no Task 3 e no E2E.
5. **Data −1 dia** por fuso: esperado `2026-10-14` → "14/10/2026" e "Aos catorze dias do mês de outubro de dois mil e vinte e seis" em qualquer fuso. Teste no Task 2 (resultados + garantia estrutural de que `dates.ts` não usa `Date`).

---

### Task 1: Tokens visuais, fontes, casca do app e configuração do site

**Files:**

- Create: `apps/web/src/styles/tokens.css`, `apps/web/src/styles/base.css`, `apps/web/src/config/site.ts`, `apps/web/src/shell/AppShell.tsx`, `apps/web/src/shell/AppShell.module.css`, `apps/web/src/shell/Header.tsx`, `apps/web/src/shell/Footer.tsx`, `apps/web/src/shell/MobileTabs.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/main.tsx`, `apps/web/vite.config.ts` (define `__COMMIT_SHA__`), `apps/web/package.json`
- Test: `apps/web/src/shell/AppShell.test.tsx`

**Interfaces:**

- Produces:
  ```ts
  // config/site.ts — fonte única
  export const SITE = {
    nome: 'Lavra',
    slogan: 'Atas de reunião com IA e privacidade verificável',
    autor: 'Diego Antunes',
    linkedin: 'https://www.linkedin.com/in/diego-ozorio-antunes/',
    repositorio: 'https://github.com/MadCrow69/lavra-ata',
    commit: __COMMIT_SHA__, // string; 'dev' fora do build do CI
  } as const;
  // shell/AppShell.tsx
  export function AppShell(props: { editar: ReactNode; documento: ReactNode }): JSX.Element;
  ```
- Identidade "Cartório moderno" (spec 7.3) em tokens CSS com modo escuro (`prefers-color-scheme` + `:root[data-theme]`): ponto de partida azul-petróleo `#1d4e5f`, terracota `#b5643c`, creme `#f6f1e7`, grafite `#1f2a37`; contraste AA conferido. Fontes: `@fontsource-variable/source-serif-4` (títulos) e `@fontsource-variable/inter` (interface), importadas no bundle (versões ≥ 7 dias).
- Header: marca "Lavra" + `GitHub ↗` (`SITE.repositorio`) + botão `Configurar chaves de IA` (abre o modal do Task 6; até lá, prop `onConfigurarChaves`). **Não** incluir "Ver exemplo" nem "Privacidade" (Plano 06) — sem botão morto.
- Footer: "Feito por Diego Antunes" (link LinkedIn, `rel="noopener noreferrer"`, `target="_blank"`) · "Código aberto (MIT)" (link repo) · "versão `<7 primeiros do commit>`" (link `${repositorio}/commit/${commit}`; texto "versão de desenvolvimento" quando `dev`).
- Layout: ≥ 1024 px duas colunas (Editar | Documento); < 1024 px abas "Editar" / "Documento" (`role="tablist"`, teclado ←/→). Sem overflow horizontal a 360 px.
- `vite.config.ts`: `define: { __COMMIT_SHA__: JSON.stringify(process.env.GITHUB_SHA ?? 'dev') }` + declaração de tipo global.

- [ ] **Step 1: Testes que falham** — `AppShell.test.tsx`: renderiza os dois painéis; link do LinkedIn com `href` de `SITE.linkedin` e `rel` contendo `noopener`; texto "versão de desenvolvimento" quando `commit === 'dev'`; em largura < 1024 (mock de `matchMedia`), `getByRole('tab', { name: 'Documento' })` alterna o painel visível e a seta → move o foco.
- [ ] **Step 2:** rodar → FAIL. **Step 3:** implementar. **Step 4:** rodar → PASS; `pnpm --filter @lavra/web build` → PASS com `check-csp`.
- [ ] **Step 5: Commit** — `feat(web): adiciona identidade visual, casca do app e rodapé com autoria`

---

### Task 2: Domínio do rascunho, datas por extenso e persistência

**Files:**

- Create: `apps/web/src/domain/draft.ts`, `apps/web/src/domain/draft-reducer.ts`, `apps/web/src/domain/dates.ts`, `apps/web/src/domain/persistence.ts`, `apps/web/src/domain/DraftContext.tsx`, `apps/web/src/config/limits.ts`, `apps/web/src/config/storage-keys.ts`
- Test: `apps/web/src/domain/dates.test.ts`, `apps/web/src/domain/draft-reducer.test.ts`, `apps/web/src/domain/persistence.test.ts`

**Interfaces:**

- Produces:
  ```ts
  export type Presenca = 'presente' | 'ausente' | 'justificado';
  export type Tom = 'formal' | 'conciso' | 'detalhado';
  export interface Participante {
    id: string;
    nome: string;
    papel: string;
    presenca: Presenca;
    justificativa: string;
    extras: Record<string, string>;
  }
  export type Bloco = { tipo: 'paragrafo' | 'lista'; texto: string; itens: string[] };
  export type StatusEncaminhamento = 'pendente' | 'em_andamento' | 'concluido' | 'cancelado';
  export interface Encaminhamento {
    acao: string;
    responsavel: string;
    prazo: string;
    status: StatusEncaminhamento;
  }
  export interface Atribuicao {
    provedor: ProviderId;
    modelo: string;
    fallbackDe: ProviderId[];
  }
  export interface ResultadoAta {
    secoes: Record<string, Bloco[]>;
    encaminhamentos: Encaminhamento[];
    atribuicao: Record<string, Atribuicao>;
    avisos: Record<string, string[]>;
    editadas: string[];
  } // atribuicao/avisos por chave de seção ('encaminhamentos' incluso); editadas = seções alteradas à mão
  export interface AtaDraft {
    versao: 1;
    tipoId: string;
    tom: Tom;
    dados: Record<string, string>; // campos do tipo (Task 3), datas AAAA-MM-DD, horas HH:MM
    pauta: string[];
    participantes: Participante[];
    transcricao: string;
    mapa: MaskMap | null; // @lavra/pii-br, mesmo mapa por rascunho
    resultado: ResultadoAta | null;
  }
  export type DraftAction =
    | { type: 'definirTipo'; tipoId: string }
    | { type: 'definirTom'; tom: Tom }
    | { type: 'definirCampo'; campo: string; valor: string }
    | { type: 'definirPauta'; itens: string[] }
    | { type: 'adicionarParticipantes'; nomes: string[] }
    | { type: 'atualizarParticipante'; id: string; patch: Partial<Participante> }
    | { type: 'removerParticipante'; id: string }
    | { type: 'definirTranscricao'; texto: string }
    | { type: 'registrarResultado'; resultado: ResultadoAta; mapa: MaskMap }
    | {
        type: 'substituirSecao';
        chave: string;
        blocos: Bloco[];
        avisos: string[];
        atribuicao: Atribuicao | null;
        mapa: MaskMap | null;
      } // atribuicao null = edição manual (marca em `editadas`)
    | {
        type: 'substituirEncaminhamentos';
        itens: Encaminhamento[];
        avisos: string[];
        atribuicao: Atribuicao | null;
        mapa: MaskMap | null;
      }
    | { type: 'novaAta' };
  export function draftReducer(state: AtaDraft, action: DraftAction): AtaDraft;
  export function criarRascunho(tipoId?: string): AtaDraft;
  // dates.ts
  export function formatarData(iso: string): string; // '2026-10-14' → '14/10/2026'
  export function formatarDataPorExtenso(iso: string): string; // → 'Aos catorze dias do mês de outubro de dois mil e vinte e seis'
  export function formatarHora(hhmm: string): string; // '14:30' → '14h30', '09:00' → '9h'
  // persistence.ts
  export function salvarRascunho(d: AtaDraft): void; // sessionStorage, try/catch, nunca lança
  export function carregarRascunho(): AtaDraft | null; // valida versao; corrompido → null
  ```
- `limits.ts`: `LIMITE_TRANSCRICAO = 300_000` caracteres (≈ 2 h de reunião com folga), `LIMITE_INSTRUCAO = 1_000`, `LIMITE_PARTICIPANTES = 500`, `DEBOUNCE_DETECCAO_MS = 300`.
- `storage-keys.ts`: `RASCUNHO = 'lavra:rascunho:v1'` (sessionStorage), `CHAVES = 'lavra:chaves:v1'` e `PREFERENCIAS = 'lavra:preferencias:v1'` (localStorage).
- `novaAta` preserva `tipoId` e `tom`, zera o resto.
- `formatarDataPorExtenso`: dias 1 → "Ao primeiro dia do mês de…", demais "Aos <n por extenso> dias…"; ano por extenso (1900–2199).

- [ ] **Step 1: Testes que falham** — datas: os exemplos acima; `2026-10-01` → "Ao primeiro dia do mês de outubro de dois mil e vinte e seis"; `2026-02-29` (inválida) → lança `RangeError` com mensagem em pt-BR; um teste lê o fonte de `dates.ts` e falha se encontrar `Date(` ou `new Date` (garantia estrutural contra o bug de fuso). Reducer: cada ação; `novaAta` preserva tipo e tom; `adicionarParticipantes` ignora linhas vazias e respeita `LIMITE_PARTICIPANTES`. Persistência: ida e volta; JSON corrompido → `null`; `sessionStorage` que lança (modo privado) → não quebra; **a chave de API nunca aparece no JSON salvo** (o tipo `AtaDraft` não tem campo de chave — o teste serializa um rascunho completo e procura por `sk-` / `AIza`).
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** — `feat(web): adiciona domínio do rascunho, datas por extenso e persistência na sessão`

---

### Task 3: Registro de tipos de ata, tipo corporativa e formulário

**Files:**

- Create: `apps/web/src/ata-types/types.ts`, `apps/web/src/ata-types/registry.ts`, `apps/web/src/ata-types/corporativa.ts`, `apps/web/src/ata-types/regras-comuns.ts`
- Create: `apps/web/src/features/form/TipoBlock.tsx`, `DadosBlock.tsx`, `ParticipantesBlock.tsx`, `FormBlock.tsx` (bloco recolhível com ✓/"falta: X"), `features/form/form.module.css`
- Create: `apps/web/src/ui/Field.tsx`, `apps/web/src/ui/Button.tsx`
- Test: `apps/web/src/ata-types/corporativa.test.ts`, `apps/web/src/features/form/form.test.tsx`

**Interfaces:**

- Produces:
  ```ts
  export interface CampoDef {
    id: string;
    rotulo: string;
    tipo: 'texto' | 'data' | 'hora' | 'escolha' | 'textoLongo';
    obrigatorio: boolean;
    opcoes?: { valor: string; rotulo: string }[];
    ajuda?: string;
    visivelSe?: (dados: Record<string, string>) => boolean;
  }
  export interface SecaoDef {
    chave: string;
    titulo: string;
    instrucao: string;
  } // narrativa: Bloco[]
  export interface AtaTypeDefinition {
    id: string;
    rotulo: string;
    descricao: string;
    campos: CampoDef[];
    camposParticipante: CampoDef[]; // extras além de nome/papel/presença
    rotuloPapel: string; // ex.: 'Cargo / empresa'
    secoes: SecaoDef[]; // ordem do documento
    temEncaminhamentos: boolean;
    regrasPrompt: string[]; // regras específicas do tipo (texto do Lavra, escrito do zero)
    titulo: (dados: Record<string, string>) => string;
    preambulo: (d: AtaDraft) => string; // texto fixo do template
    fecho: (d: AtaDraft) => string;
    assinaturas: (d: AtaDraft) => { nome: string; papel: string }[];
  }
  export const ATA_TYPES: Record<string, AtaTypeDefinition>; // neste plano: só 'corporativa'
  export function camposFaltando(
    d: AtaDraft,
    tipo: AtaTypeDefinition,
  ): { bloco: 'dados' | 'participantes' | 'transcricao'; campo: string; rotulo: string }[];
  ```
- Corporativa (spec 7.4a): campos `organizacao*`, `assunto*`, `data*`, `inicio*`, `fim`, `modalidade*` (presencial/remota/híbrida), `local` (rótulo muda para "Plataforma" se remota; obrigatório se presencial/híbrida), `conducao`, `redacao`; pauta (um item por linha) obrigatória; participantes: nome*, papel ("Cargo / empresa"), presença* + justificativa se `justificado`. Seções: `resumo`, `discussao`, `decisoes`, `pendencias`, `riscos`, `proxima_reuniao`; `temEncaminhamentos: true`.
- Bloco de participantes: tabela editável + botão "Colar lista" (um nome por linha; aceita "Nome — Cargo"); contador "N participantes · X presentes"; com > 20 linhas a tabela tem altura máxima com rolagem e cabeçalho fixo; busca por nome quando > 20; ação "Marcar todos como presentes".
- Validação no blur, erro abaixo do campo ("Informe a data da reunião."), `*` em obrigatórios, máscara de data/hora via `<input type="date|time">`.

- [ ] **Step 1: Testes que falham** — `corporativa.test.ts`: `camposFaltando` de um rascunho vazio lista organização, assunto, data, início, modalidade, pauta, pelo menos um participante presente, transcrição; `local` só falta quando modalidade é presencial/híbrida; `titulo` gera "Ata de reunião — <assunto>"; `preambulo` usa `formatarDataPorExtenso` e `formatarHora`. `form.test.tsx`: preencher e sair do campo data vazio mostra "Informe a data da reunião."; colar 200 linhas em "Colar lista" cria 200 participantes em < 500 ms e mostra "200 participantes"; busca filtra; o bloco mostra "✓" quando completo e "falta: Data, Pauta" quando não.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** — `feat(web): adiciona registro de tipos de ata e formulário da ata corporativa`

---

### Task 4: Transcrição, arquivo .vtt e prévia de privacidade

**Files:**

- Create: `apps/web/src/features/transcript/vtt.ts`, `apps/web/src/features/form/TranscricaoBlock.tsx`, `apps/web/src/features/privacy/PrivacyPreview.tsx`, `apps/web/src/features/privacy/usePrivacyScan.ts`, `apps/web/src/ui/Modal.tsx`
- Modify: `apps/web/package.json` (dependência `@lavra/pii-br: workspace:*`)
- Test: `apps/web/src/features/transcript/vtt.test.ts`, `apps/web/src/features/privacy/privacy.test.tsx`, `apps/web/src/ui/Modal.test.tsx`

**Interfaces:**

- Produces:
  ```ts
  export function vttParaTexto(vtt: string): string; // "Nome: fala" por linha, sem timestamps; falas consecutivas do mesmo falante unidas; aceita <v Nome>, "Nome: texto" e CRLF
  export function usePrivacyScan(texto: string): {
    contagem: Partial<Record<PiiType, number>>;
    total: number;
    mascarado: string;
    pendente: boolean;
  };
  export function Modal(props: {
    aberto: boolean;
    titulo: string;
    onFechar: () => void;
    children: ReactNode;
    acoes?: ReactNode;
  }): JSX.Element | null; // focus trap, Esc, retorno de foco, aria-modal
  ```
- Transcrição: textarea com altura máxima e rolagem; botões "Enviar .txt ou .vtt" (`accept=".txt,.vtt,text/plain,text/vtt"`, até 5 MB, lido com `File.text()`, erro claro para outro formato) e "Limpar"; contador verde → amarelo (≥ 90% de `LIMITE_TRANSCRICAO`) → vermelho (acima) com mensagem "A transcrição passou do limite de 300 mil caracteres. Divida a reunião ou remova trechos sem conteúdo."
- Prévia de privacidade: `usePrivacyScan` usa `mask` com debounce `DEBOUNCE_DETECCAO_MS`; selo "🛡 N dados pessoais serão protegidos (2 CPF, 3 telefones…)" (pluralização correta; "Nenhum dado pessoal estruturado encontrado" quando 0) + botão "Ver o que vai para a IA" → Modal com duas colunas "Original" × "Enviado à IA" (rolagem sincronizada não é obrigatória), marcadores destacados (usar `findMarkers` do `@lavra/pii-br` para fatiar o texto em nós), e o aviso fixo: "Nomes de pessoas não são removidos — a ata precisa deles." Em telas < 1024 px as colunas empilham.
- Rótulos dos tipos no selo: CPF, CNPJ, e-mail, telefone, CEP, placa, PIS, RG, cartão.

- [ ] **Step 1: Testes que falham** — `vtt.test.ts`: arquivo com cabeçalho `WEBVTT`, cues com `<v Maria Souza>` e timestamps → "Maria Souza: …"; duas falas seguidas do mesmo falante unidas; CRLF; vtt sem falante → só texto. `privacy.test.tsx`: colar texto com 2 CPF e 1 telefone mostra (após debounce, com timers falsos) "3 dados pessoais serão protegidos (2 CPF, 1 telefone)"; o modal mostra `[CPF_1]` destacado e não mostra o CPF na coluna "Enviado à IA"; colar 200 mil caracteres não trava (o `onChange` responde em < 50 ms medido; a detecção só roda após o debounce); acima do limite aparece a mensagem vermelha. `Modal.test.tsx`: Esc fecha, Tab circula dentro, foco volta ao botão de origem.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** — `feat(web): adiciona transcrição com .vtt e prévia do que vai para a IA`

---

### Task 5: Adaptadores dos provedores e cadeia de fallback

**Files:**

- Create: `apps/web/src/ai/types.ts`, `apps/web/src/config/models.ts`, `apps/web/src/ai/json-schema.ts`, `apps/web/src/ai/providers/openai.ts`, `apps/web/src/ai/providers/gemini.ts`, `apps/web/src/ai/providers/anthropic.ts`, `apps/web/src/ai/chain.ts`, `apps/web/src/ai/errors.ts`
- Test: `apps/web/src/ai/providers/providers.test.ts`, `apps/web/src/ai/chain.test.ts`, `apps/web/src/ai/json-schema.test.ts`

**Interfaces:**

- Produces:
  ```ts
  export type ProviderId = 'openai' | 'gemini' | 'anthropic';
  export interface JsonSchema {
    type: 'object' | 'array' | 'string';
    properties?: Record<string, JsonSchema>;
    required?: string[];
    additionalProperties?: false;
    items?: JsonSchema;
    enum?: string[];
  }
  export interface GenerateRequest {
    sistema: string;
    usuario: string;
    schema: JsonSchema;
    nomeSchema: string;
    signal: AbortSignal;
  }
  export interface ProviderConfig {
    id: ProviderId;
    modelo: string;
    chave: string;
  }
  export type ErroTipo =
    | 'chave_invalida'
    | 'limite'
    | 'instavel'
    | 'cortado'
    | 'json_invalido'
    | 'recusa'
    | 'rede'
    | 'parametro'
    | 'cancelado';
  export class ErroProvedor extends Error {
    readonly tipo: ErroTipo;
    readonly provedor: ProviderId;
    readonly status?: number;
  } // message em pt-BR, NUNCA contém a chave
  export interface ProviderAdapter {
    id: ProviderId;
    rotulo: string;
    gerar(cfg: ProviderConfig, req: GenerateRequest): Promise<unknown>;
    testarChave(cfg: Omit<ProviderConfig, 'modelo'>, signal: AbortSignal): Promise<void>;
  }
  export function validarSchema(valor: unknown, schema: JsonSchema): string[]; // lista de problemas; [] = válido
  export interface ResultadoCadeia<T> {
    valor: T;
    provedor: ProviderId;
    modelo: string;
    falhas: { provedor: ProviderId; erro: ErroTipo; mensagem: string }[];
  }
  export async function gerarComFallback(
    cadeia: ProviderConfig[],
    req: GenerateRequest,
  ): Promise<ResultadoCadeia<unknown>>; // lança AggregateError-like ErroCadeia com todas as falhas quando todos falham
  // config/models.ts — fonte única
  export const MODELOS: Record<
    ProviderId,
    { padrao: string; opcoes: { id: string; rotulo: string }[]; maxSaida: number }
  >;
  ```
- Valores **[decisão do autor: padrão = modelos menores/baratos; a pessoa escolhe outro se quiser]**: `MODELOS.openai.padrao = 'gpt-6-luna'` (esforço `none`; opção maior `gpt-6.1-sol`), `MODELOS.gemini.padrao = 'gemini-3.8-flash'` (verificado; opção `gemini-3.5-flash-lite`), `MODELOS.anthropic.padrao = 'claude-haiku-5-5'` (esforço `low`; opções `claude-sonnet-5-5`, `claude-opus-5-5`); `maxSaida = 16_000` nos três. No modal, cada provedor mostra o modelo escolhido com o rótulo "(padrão, mais econômico)" no padrão. Campo de modelo livre é permitido no modal (Task 6) — o adaptador não depende de o id estar na lista.
- Classificação de erro: HTTP 401/403 → `chave_invalida`; 429 → `limite`; 5xx/529 → `instavel`; 400 com mensagem de parâmetro/valor não suportado → `parametro` (mensagem "O modelo X não aceitou a configuração enviada. Escolha outro modelo nas configurações."); `TypeError` do fetch → `rede` ("O provedor recusou a chamada direta do navegador ou a conexão falhou."); OpenAI `status: 'incomplete'` + `max_output_tokens`, Gemini `finishReason: 'MAX_TOKENS'`, Anthropic `stop_reason: 'max_tokens'` → `cortado`; recusa (OpenAI item `refusal`, Gemini `finishReason: 'SAFETY'|'RECITATION'`/`promptFeedback.blockReason`, Anthropic `stop_reason: 'refusal'`) → `recusa`; texto que não é JSON ou não passa em `validarSchema` → `json_invalido`; `AbortError` → `cancelado` (interrompe a cadeia).
- Cadeia: sequencial; avança em qualquer erro exceto `cancelado`; retry único com espera de 2 s só em `limite`/`instavel` antes de avançar.

- [ ] **Step 1: Testes que falham** (fetch falso via `vi.fn`, sem rede) — para cada provedor: corpo e headers exatos (OpenAI inclui `store: false` e `reasoning.effort: 'none'`; Gemini não envia `thinkingConfig`; Anthropic envia o header de acesso direto); `credentials: 'omit'` e `referrerPolicy: 'no-referrer'`; resposta de sucesso devolve o objeto; cada caso de erro vira o `ErroTipo` certo; **nenhuma `message` de erro contém a chave** (teste com chave `sk-teste-123` e respostas de erro que ecoam o header). `json-schema.test.ts`: objeto com chave extra → problema; campo faltando → problema; enum fora → problema; tipos aninhados. `chain.test.ts`: primeiro falha com 429 duas vezes e o segundo responde → resultado do segundo com `falhas` registrando o primeiro; `cancelado` não tenta o próximo; todos falham → erro com as três falhas.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** — `feat(web): adiciona adaptadores de OpenAI, Gemini e Anthropic com fallback`

---

### Task 6: Gerenciador de chaves e modal de configuração

**Files:**

- Create: `apps/web/src/ai/keys.ts`, `apps/web/src/features/keys/KeysModal.tsx`, `apps/web/src/features/keys/keys.module.css`
- Modify: `apps/web/src/shell/Header.tsx`, `apps/web/src/App.tsx`
- Test: `apps/web/src/ai/keys.test.ts`, `apps/web/src/features/keys/KeysModal.test.tsx`

**Interfaces:**

- Produces:
  ```ts
  export interface ChaveProvedor {
    provedor: ProviderId;
    chave: string;
    modelo: string;
    estado: 'nao_testada' | 'ok' | 'invalida';
  }
  export interface KeyStore {
    listar(): ChaveProvedor[];
    ordem(): ProviderId[];
    definir(c: ChaveProvedor): void;
    remover(p: ProviderId): void;
    reordenar(ordem: ProviderId[]): void;
    lembrar(): boolean;
    definirLembrar(v: boolean): void;
    cadeia(): ProviderConfig[];
    apagarTudo(): void;
  }
  export function criarKeyStore(storage?: Storage | null): KeyStore; // memória; persiste em localStorage só com lembrar=true
  export function useKeys(): KeyStore & { versao: number }; // re-render em mudança
  ```
- Modal "Chaves de IA": um cartão por provedor (OpenAI, Google Gemini, Anthropic) com campo `type="password"` + botão mostrar/ocultar com `aria-label`, `autocomplete="off"`, `spellcheck=false`; modelo (select das opções + "Outro modelo…" texto livre); "Testar" (estado ✓/✕ com texto); "Apagar"; link "Onde conseguir a chave ↗"; setas ↑/↓ (acessíveis por teclado) para a ordem de preferência; checkbox "Lembrar neste navegador" desmarcado, com aviso: "A chave ficará salva neste navegador. Qualquer extensão ou pessoa com acesso a ele poderá lê-la. Prefira uma chave com limite de gasto."; botão "Apagar todas as chaves". Texto no topo: "Suas chaves ficam só neste navegador e vão direto para o provedor escolhido. Nenhum servidor do Lavra recebe nada."
- Header mostra o estado: "Configurar chaves de IA" sem chave; "IA: OpenAI → Gemini" com chaves.

- [ ] **Step 1: Testes que falham** — `keys.test.ts`: sem lembrar nada vai para storage; com lembrar a chave é salva em `CHAVES` e restaurada; desmarcar apaga do storage; `apagarTudo` limpa memória e storage; `cadeia()` respeita a ordem e omite provedores sem chave. `KeysModal.test.tsx`: preencher, testar (adaptador falso) mostra "Chave válida" / "Chave inválida: verifique se copiou a chave inteira"; ordem muda com setas e teclado; Esc fecha; **a chave não aparece em nenhum `storage` sem lembrar, nem no DOM fora do input**.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** — `feat(web): adiciona configuração de chaves com ordem de preferência`

---

### Task 7: Montagem do prompt e pipeline de geração

**Files:**

- Create: `apps/web/src/generation/prompt.ts`, `apps/web/src/generation/output-schema.ts`, `apps/web/src/generation/normalize.ts`, `apps/web/src/generation/pipeline.ts`, `apps/web/src/features/form/GenerateBar.tsx`
- Test: `apps/web/src/generation/prompt.test.ts`, `apps/web/src/generation/pipeline.test.ts`, `apps/web/src/features/form/GenerateBar.test.tsx`

**Interfaces:**

- Consumes: `AtaTypeDefinition`, `gerarComFallback`, `KeyStore.cadeia()`, `mask`/`unmask`/`validateOutput` do `@lavra/pii-br`.
- Produces:
  ```ts
  export function schemaDaAta(tipo: AtaTypeDefinition): JsonSchema; // { secoes: {<chave>: Bloco[]...}, encaminhamentos: Encaminhamento[] } — Bloco uniforme {tipo enum, texto, itens}
  export function schemaDaSecao(tipo: AtaTypeDefinition, chave: string): JsonSchema; // só a seção (ou só encaminhamentos)
  export function montarPrompt(
    tipo: AtaTypeDefinition,
    d: AtaDraft,
    transcricaoMascarada: string,
  ): { sistema: string; usuario: string };
  export function montarPromptSecao(
    tipo: AtaTypeDefinition,
    d: AtaDraft,
    chave: string,
    textoAtualMascarado: string,
    instrucaoMascarada: string | null,
    transcricaoMascarada: string,
  ): { sistema: string; usuario: string };
  export function normalizarResultado(
    bruto: unknown,
    tipo: AtaTypeDefinition,
  ): { secoes: Record<string, Bloco[]>; encaminhamentos: Encaminhamento[] };
  export async function gerarAta(
    d: AtaDraft,
    tipo: AtaTypeDefinition,
    cadeia: ProviderConfig[],
    signal: AbortSignal,
  ): Promise<{ resultado: ResultadoAta; mapa: MaskMap; colisoes: string[] }>;
  export async function regerarSecao(
    d: AtaDraft,
    tipo: AtaTypeDefinition,
    chave: string,
    instrucao: string | null,
    cadeia: ProviderConfig[],
    signal: AbortSignal,
  ): Promise<{
    blocos: Bloco[] | Encaminhamento[];
    avisos: string[];
    mapa: MaskMap;
    atribuicao: Atribuicao;
  }>;
  ```
- Prompt (texto escrito do zero, em pt-BR, regras da spec 7.5): papel de secretário que redige atas formais; pt-BR com acentuação, impessoal; **não inventar** (decisão só se explícita; aprovação/unanimidade/votos só se ditos; lacuna → `[PREENCHER: o que falta]`); responsável sem clareza → "A definir"; prazo `AAAA-MM-DD` quando claro senão texto; nomes exatamente como aparecem; **marcadores `[TIPO_N]` copiados literalmente**; sem títulos, sem HTML/Markdown; tom: formal (padrão), conciso (~metade), detalhado (~dobro sem fatos novos); + `tipo.regrasPrompt`. Mensagem do usuário: tipo, data, modalidade, pauta, participantes (nome, papel, presença — sem identificadores do formulário), tom, transcrição mascarada.
- Pipeline: `mask(transcricao, { map: d.mapa ?? createMaskMap() })` → prompt → cadeia → `normalizarResultado` → `validateOutput(JSON.stringify(bruto), mapa, textoEnviado)` (texto enviado = `usuario`, mascarado) → avisos por seção (marcadores desconhecidos/quebrados, identificadores novos com o tipo: "A IA citou um telefone que não estava na transcrição — confira.") → `unmask` campo a campo. `colisoes` não vazias viram aviso ao topo ("Seu texto já tinha um trecho parecido com um marcador ([CPF_1]); ele foi mantido como [CPF#1].").
- Regerar/Ajustar: mascara **o texto atual da seção já desmascarado** e a instrução com o mesmo mapa (nunca re-mascarar texto mascarado).
- Normalização: trim; responsável vazio → "A definir"; status ausente → `pendente`; encaminhamento sem ação descartado; seção ausente → `[]`.
- GenerateBar: botão "✨ Gerar ata" desabilitado com resumo "Falta: Data, Pauta" (clicar no resumo leva ao primeiro campo); sem chave → abre o modal de chaves; com chave → "Envia para OpenAI · gpt-6-luna (depois Gemini)"; durante a geração: progresso indeterminado + "Gerando a ata — pode levar até 2 minutos." + "Cancelar"; ao terminar: toast "Ata gerada por Gemini · gemini-3.8-flash" (+ "OpenAI falhou: limite de uso" quando houve fallback); erro: mensagem com causa + ação + "Tentar de novo". Regerar tudo com conteúdo existente pede confirmação em Modal.

- [ ] **Step 1: Testes que falham** — `prompt.test.ts`: o `usuario` contém `[CPF_1]` e **não** contém `529.982.247-25`; contém a pauta e os participantes; não contém campos do formulário que não sejam metadados; regras de "não inventar" e de marcadores presentes no `sistema`. `pipeline.test.ts` (cadeia falsa): resposta com `[CPF_1]` volta com o CPF; resposta com `[CPF_9]` gera aviso na seção certa; resposta com telefone inventado gera aviso; colisão gera aviso global; `regerarSecao` com instrução contendo CPF envia o CPF mascarado; cancelamento propaga `cancelado` sem alterar o rascunho. `GenerateBar.test.tsx`: estados (falta, sem chave, gerando, sucesso com fallback, erro) com os textos acima.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** — `feat(web): adiciona geração da ata com mascaramento, validação e fallback`

---

### Task 8: Folha A4 em HTML (modelo de documento + prévia ao vivo)

**Files:**

- Create: `apps/web/src/document/model.ts`, `apps/web/src/document/build-model.ts`, `apps/web/src/features/preview/A4Preview.tsx`, `apps/web/src/features/preview/preview.module.css`
- Test: `apps/web/src/document/build-model.test.ts`, `apps/web/src/features/preview/A4Preview.test.tsx`

**Interfaces:**

- Produces (consumido também pelos renderizadores PDF/DOCX do Plano 04):
  ```ts
  export type Inline = { texto: string; destaque?: 'preencher' };
  export type DocBloco =
    | { tipo: 'titulo'; texto: string }
    | { tipo: 'subtitulo'; texto: string }
    | { tipo: 'paragrafo'; partes: Inline[] }
    | { tipo: 'lista'; itens: Inline[][] }
    | { tipo: 'secao'; chave: string; titulo: string; blocos: DocBloco[]; gerada: boolean }
    | { tipo: 'tabela'; colunas: string[]; linhas: string[][]; larguras?: number[] }
    | { tipo: 'assinaturas'; pessoas: { nome: string; papel: string }[] }
    | { tipo: 'aviso'; texto: string };
  export interface DocumentModel {
    titulo: string;
    cabecalho: { logo: string | null; linhas: string[] };
    blocos: DocBloco[];
    rodape: string;
  }
  export function construirDocumento(d: AtaDraft, tipo: AtaTypeDefinition): DocumentModel;
  export function dividirPreencher(texto: string): Inline[]; // '[PREENCHER: local]' vira destaque
  ```
- A folha mostra **ao vivo**, antes de gerar: título, cabeçalho (organização, data, horário, modalidade/local), participantes em tabela (Nome · Cargo/empresa · Presença com ícone+texto), pauta e placeholders "As seções aparecem aqui depois de gerar a ata." Depois de gerar: seções na ordem do tipo, tabela de encaminhamentos (Ação 50% · Responsável · Prazo `dd/mm/aaaa` quando data · Status), fecho, assinaturas e o aviso de minuta (spec 7.4). Seção vazia não aparece (exceto placeholders antes de gerar). Logo: espaço reservado "Sua logo" (upload no Plano 04).
- Aparência A4: largura proporcional ao painel, proporção 210×297, tipografia serifada, legível no celular (aba "Documento").
- Contador de `[PREENCHER]` acima da folha: "2 campos para preencher" (clicável → rola até o primeiro).

- [ ] **Step 1: Testes que falham** — `build-model.test.ts`: rascunho sem resultado gera título, cabeçalho, tabela de participantes e placeholder; com resultado gera seções na ordem, tabela de encaminhamentos com `2026-10-30` → "30/10/2026" e "próxima reunião" mantido; `[PREENCHER: local]` vira inline com destaque; 200 participantes viram 200 linhas. `A4Preview.test.tsx`: renderiza o modelo; status de presença com texto ("Presente", "Ausente", "Justificado") além da cor; contador de PREENCHER.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** — `feat(web): adiciona modelo de documento e folha A4 com prévia ao vivo`

---

### Task 9: Revisão por seção (editar, regerar, ajustar com instrução)

**Files:**

- Create: `apps/web/src/features/preview/SectionActions.tsx`, `apps/web/src/features/preview/SectionEditor.tsx`, `apps/web/src/features/preview/EncaminhamentosEditor.tsx`
- Modify: `apps/web/src/features/preview/A4Preview.tsx`
- Test: `apps/web/src/features/preview/section.test.tsx`

**Interfaces:**

- Consumes: `regerarSecao`, `draftReducer` (`substituirSecao`, `substituirEncaminhamentos`).
- Cada seção gerada tem, ao foco/hover e sempre visível no toque: **Editar** (textarea com o texto da seção; parágrafos separados por linha em branco, itens de lista começando com "- "; salvar/cancelar; Esc cancela), **Regerar** (só a seção; confirma se a seção foi editada à mão: "Você editou esta seção. Regerar vai substituir suas edições."), **Ajustar com instrução** (campo até `LIMITE_INSTRUCAO` com contador; exemplos de placeholder "Deixe mais curto", "Destaque os prazos").
- Encaminhamentos: editor de linhas (ação, responsável, prazo, status) com adicionar/remover e as mesmas ações de IA.
- Busy por seção (o resto da folha continua utilizável); avisos de `validateOutput` exibidos acima da seção com ícone + texto.
- Atribuição por seção, discreta: "Gerado por Gemini · gemini-3.8-flash".

- [ ] **Step 1: Testes que falham** — editar e salvar atualiza o rascunho e a folha; Esc cancela sem alterar; regerar chama `regerarSecao` com o texto atual (inclusive edição manual) e substitui só aquela seção; ajustar envia a instrução; seção editada pede confirmação antes de regerar; aviso de identificador inventado aparece na seção certa; durante o busy de uma seção, outra seção continua editável.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** — `feat(web): adiciona revisão por seção com edição, regeração e ajuste`

---

### Task 10: Integração da bancada, estados e acessibilidade

**Files:**

- Create: `apps/web/src/features/workbench/Workbench.tsx`, `apps/web/src/ui/Toast.tsx`
- Modify: `apps/web/src/App.tsx`, componentes dos Tasks 3–9 conforme necessário
- Test: `apps/web/src/features/workbench/workbench.test.tsx`

- Monta: `AppShell` (Editar = blocos 1–4 + GenerateBar; Documento = A4Preview), `DraftContext` com `salvarRascunho` debounced (500 ms) e `carregarRascunho` na abertura (com aviso "Rascunho recuperado desta aba." + "Começar do zero"), botão "Nova ata" (confirmação em Modal), modal de chaves.
- Estados obrigatórios (ux-ui-defensive 2.4/2.8): após gerar, a folha rola até o topo e o toast diz o que mudou; após "Nova ata", a tela diz "Nova ata iniciada. Tipo e tom mantidos."; nenhum vazio genérico após ação.
- Acessibilidade: todos os campos com `<label>`; botões só-ícone com `aria-label`; foco visível; ordem de Tab lógica; `aria-live="polite"` para progresso e toasts.

- [ ] **Step 1: Teste de integração que falha** — com adaptador falso: preencher dados mínimos, colar transcrição com CPF, configurar chave falsa, gerar → folha mostra seções com o CPF restaurado e o toast "Ata gerada por…"; recarregar (novo render lendo `sessionStorage`) recupera o rascunho com o aviso; "Nova ata" pede confirmação e limpa.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** — `feat(web): integra a bancada com rascunho, estados e acessibilidade`

---

### Task 11: E2E no build com CSP ativa, rede auditada e volume

**Files:**

- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/fluxo-ata.spec.ts`, `apps/web/e2e/fixtures/respostas.ts`, `apps/web/scripts/csp-verify.mjs` (função pura `verificarCsp(html, csp)` extraída de `check-csp.mjs`)
- Modify: `apps/web/scripts/check-csp.mjs` (usa `verificarCsp`), `apps/web/package.json` (scripts `e2e`), `.github/workflows/ci.yml` (job `e2e`), `.gitignore` (já cobre `playwright-report/`, `test-results/`)
- Test: `apps/web/scripts/csp-verify.test.ts`

- `verificarCsp` passa a reprovar também: `<style>` inline, atributo `style=`, handlers `on*=`, `<meta>` de CSP dentro de comentário HTML, `<script src>` antes do `<meta>` de CSP, `href="data:"` (itens adiados do Plano 01). Testes unitários para cada caso.
- Playwright (`@playwright/test`, só chromium) contra `vite preview` do build. `context.route('**/*')`: permite `localhost`; intercepta os três provedores com respostas fixas (`fixtures/respostas.ts`, JSON no formato real de cada provedor); **qualquer outro host aborta e entra numa lista de violações**; `serviceWorkers: 'block'`. Listener de `securitypolicyviolation` via `page.addInitScript` acumulando em `window.__violacoes`.
- Cenários: (1) fluxo completo com OpenAI interceptada (429) → fallback para Gemini → folha com seções, toast de fallback, CPF restaurado; assert `violacoes de rede = []` e `violacoes de CSP = []`; o corpo enviado ao provedor contém `[CPF_1]` e não contém o CPF; (2) viewport 360×740: sem overflow horizontal (`document.documentElement.scrollWidth <= clientWidth`) e medindo o `right` dos cartões contra o contêiner; abas Editar/Documento funcionam; (3) volume: colar 200 participantes e transcrição de 200 mil caracteres → digitação continua responsiva (tempo de `fill` < 2 s) e a folha mostra 200 linhas; (4) chave nunca aparece em `localStorage`/`sessionStorage` sem "Lembrar".
- CI: job `e2e` separado (`pnpm exec playwright install --with-deps chromium`, build, `pnpm --filter @lavra/web e2e`), sem ser check obrigatório neste PR (vira obrigatório no Plano 06 após estabilizar).

- [ ] **Step 1:** testes de `verificarCsp` → FAIL → implementar → PASS.
- [ ] **Step 2:** escrever os 4 cenários E2E → rodar → corrigir até PASS (o que falhar no app volta para o task de origem como correção, com teste unitário junto).
- [ ] **Step 3: Commit** — `test(web): adiciona E2E com CSP ativa, auditoria de rede e volume`

---

### Task 12: Prova de uso narrada, documentação e PR

- [ ] **Step 1 (ux-ui-defensive gate 3):** com `pnpm --filter @lavra/web build && preview`, narrar no relatório o caminho completo começando fora da tela nova (abrir a URL → configurar chave → preencher → colar transcrição com volume → ver o que vai para a IA → gerar → revisar uma seção → nova ata), medindo overflow em 1440 / ~1000 / 360 px. Usar o navegador do MCP de DevTools se estiver livre; senão Playwright headless com screenshots no scratchpad. Encerrar o servidor de preview ao final.
- [ ] **Step 2:** atualizar `README.md` raiz (status: "em construção — já gera a ata corporativa com sua chave"), `SECURITY.md` (o que deixou de ser "(planejado)": BYOK direto, saída em texto puro, chave em memória/opt-in, mascaramento) e `docs/spike-conectividade.md` (OpenAI verificado com `none`; `store: false` adotado).
- [ ] **Step 3:** gate completo (format, lint, typecheck, `test:ci`, build, e2e); grep por nomes de terceiros; commit `docs: atualiza README, segurança e spike com o app funcionando`.
- [ ] **Step 4:** controlador: push, PR com o template, CI verde, squash merge.
