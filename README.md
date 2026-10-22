# Lavra

Gerador de atas de reunião brasileiras a partir de transcrição, projetado para rodar direto no navegador: sem servidor, com a sua própria chave de IA e com dados pessoais mascarados antes de qualquer envio.

> **Status:** em construção — gera atas corporativa, de CIPA, de assembleia de condomínio e de sócios de Ltda e baixa em PDF e DOCX com a sua logo. Os demais tipos de ata (associação e outros) e a publicação do site (demo) ainda estão no roteiro.

## Como funciona

1. Você informa a **sua chave de API** (OpenAI, Google Gemini ou Anthropic), preenche os dados da reunião, os participantes e cola a transcrição.
2. O app **mascara os identificadores pessoais** (CPF, CNPJ, telefone, e-mail, cartão etc.) com [`@lavra/pii-br`](packages/pii-br/README.md) e mostra, antes do envio, o que vai para a IA ("Original" × "Enviado à IA").
3. A chamada vai **direto do navegador ao provedor**, sem passar por servidor do Lavra. Se o provedor falhar, o app tenta o próximo da sua lista de prioridade e registra a troca na seção (ex.: "Gerado por Gemini · gemini-3.8-flash — OpenAI falhou (limite de uso)"); chave recusada pelo provedor é marcada como inválida no modal de chaves.
4. A IA devolve JSON validado por schema; o app põe os dados originais de volta **neste navegador** e monta a ata em uma folha A4, em texto puro (nunca HTML vindo da IA). Você revisa seção por seção: edita à mão, regera ou ajusta com uma instrução.
5. Com a ata revisada, você **baixa em PDF ou DOCX** (opcionalmente com a sua logo no cabeçalho) ou copia as tarefas agrupadas por responsável.

Pontos de projeto:

- **Chave só em memória** por padrão; ela só vai para o `localStorage` se você marcar "Lembrar neste navegador". Nunca vai para URL, rascunho ou mensagem de erro.
- **Modelos padrão econômicos** (o menor de cada provedor: `gpt-6-luna`, `gemini-3.8-flash`, `claude-haiku-5-5`). A barra de geração mostra qual modelo será usado e você troca no modal de chaves.
- **Nomes de pessoas não são mascarados** — a ata precisa deles. O conteúdo segue sob os termos do provedor escolhido. Veja o [modelo de ameaças](SECURITY.md).
- **Unidade, fração ideal e participação no capital não vão para a IA.** Esses campos de participante (condomínio e sócios de Ltda) ficam só neste navegador e só entram no documento: a unidade na tabela de condôminos e nas assinaturas (quando os presentes assinam); a fração ideal só na tabela (quando alguém a informa); a participação na tabela de sócios e na soma do capital presente informado, no preâmbulo da ata de Ltda. Nunca vão na requisição ao provedor.
- **Rascunho na sessão** (`sessionStorage`): recarregar a aba recupera o formulário; a transcrição e a ata gerada não vão para o `localStorage`.

### Exportação

- **PDF e DOCX nascem no navegador, sem rede.** Os geradores ([pdfmake](https://pdfmake.github.io/docs/) e [docx](https://docx.js.org/), ambos MIT) só são carregados no primeiro clique em "Baixar", da mesma origem do site; as fontes vão embutidas no próprio app, sem CDN.
- **A logo nunca vai para a IA.** Ela fica fora do rascunho: em `sessionStorage` e, só se você marcar "Lembrar logo neste navegador", também em `localStorage`. Aceita PNG, JPEG, WebP e SVG (até 2 MB); o conteúdo do arquivo é conferido antes de decodificar, e o SVG sempre vira PNG, nunca entra como marcação.
- **Antes de baixar, o app avisa** se restam campos `[PREENCHER]`, se há um editor de seção aberto (o texto ainda não salvo não entra no arquivo) e, no PDF, quais caracteres as fontes embutidas não desenham (o DOCX mostra todos, na fonte que o Word escolher).
- **Layout.** O PDF tem a logo e o timbre na primeira página, tabelas com cabeçalho repetido em cada página, "Página X de Y" em todas e o aviso de minuta. Coluna opcional de participante que ninguém preencheu (ex.: fração ideal) não sai no documento, em vez de virar uma coluna inteira de "—". Na ata corporativa, verificado abrindo PDFs de 200 participantes e 200 encaminhamentos no visualizador do Chromium; nas atas de CIPA, condomínio (200 condôminos) e sócios de Ltda, o PDF foi conferido pelo texto extraído ("Página X de Y" em todas as páginas) e pela primeira e última página renderizadas, não no visualizador. O **layout do DOCX** foi conferido pelo XML (cabeçalho de tabela repetido, linhas que não se partem, numeração de página e imagem presentes) e, para as atas de CIPA, condomínio e sócios de Ltda, abrindo os arquivos no Microsoft Word. As fontes não vão embutidas no DOCX e o Word as troca por substitutas: ali se conferiram grade, colunas, quebras de página e assinaturas, não a tipografia (o DOCX da ata corporativa e a logo no Word seguem conferidos só pelo XML; o LibreOffice não foi testado).
- **Tarefas por responsável** ("Copiar tarefas por responsável"): uma linha por tarefa, com prazo e andamento, agrupadas por pessoa. O agrupamento só ignora espaço, caixa e forma Unicode: "Ana" e "Ana Souza" continuam sendo pessoas diferentes.

### Fontes e licenças

O PDF e a folha usam **Inter** (corpo) e **Source Serif 4** (títulos), distribuídas pelo [Fontsource](https://fontsource.org/) sob a [SIL Open Font License 1.1](https://openfontlicense.org/). `pdfmake` e `docx` são MIT.

## Tipos de ata e base legal

- **Reunião corporativa:** reunião de trabalho de uma empresa, equipe ou comitê; sem exigência legal de forma.
- **CIPA:** reunião ordinária ou extraordinária da Comissão Interna de Prevenção de Acidentes e de Assédio, com representação e condição dos participantes (NR-5; Lei nº 14.457/2022, art. 23).
- **Condomínio:** assembleia geral ordinária ou extraordinária, presencial, eletrônica ou híbrida, com unidade, vínculo e fração ideal de cada condômino (Código Civil, arts. 1.334 e 1.350 a 1.355; Lei nº 4.591/1964).
- **Sócios de Ltda:** reunião ou assembleia de sócios, com participação informada no capital e representação por procurador (Código Civil, arts. 1.072 a 1.080-A; Manual de Registro de Sociedade Limitada do DREI).

Cada texto fixo dos modelos de CIPA, condomínio e Ltda aponta para o artigo ou item da norma, com link oficial e data de consulta, em [`docs/base-legal.md`](docs/base-legal.md); um teste automatizado reprova texto fixo sem linha lá. **O app não calcula quórum, fração ideal nem validade de deliberação:** votos e quórum entram na ata só como foram declarados na reunião, e o que não foi dito sai como `[PREENCHER: …]`. Na ata de Ltda, a única conta é a soma das participações informadas dos sócios presentes, exibida como "capital presente informado".

> **Avisos.** O adaptador da Anthropic foi construído pela documentação e testado com respostas interceptadas, mas **ainda não foi verificado com uma chamada real** (a conta usada nos testes está sem crédito); OpenAI e Gemini foram verificados no [spike de conectividade](docs/spike-conectividade.md). Os modelos de ata foram redigidos com base na legislação citada, **sem revisão de profissional da área** (a base de cada texto está em [`docs/base-legal.md`](docs/base-legal.md)); toda ata sai marcada como minuta. Contribuições de advogados e técnicos são bem-vindas (veja [Como contribuir](CONTRIBUTING.md)).

## Rodar localmente

Requer [pnpm](https://pnpm.io/installation); o Node 24 é provisionado pelo próprio projeto.

```bash
pnpm install
pnpm --filter @lavra/web dev       # servidor de desenvolvimento em http://localhost:5173/lavra-ata/
```

Para ver o build com a CSP ativa (o servidor de desenvolvimento não a injeta):

```bash
pnpm build
pnpm --filter @lavra/web preview   # http://localhost:4173/lavra-ata/
```

O app exige **contexto seguro** (HTTPS ou `localhost`): ele usa `crypto.randomUUID` e a área de transferência (`navigator.clipboard`), que o navegador só libera nesses contextos. Abrir por um IP da rede local em HTTP não funciona: o app mostra um aviso explicando o motivo.

Os testes (`pnpm test`, `pnpm --filter @lavra/web e2e`) e o fluxo de contribuição estão em [CONTRIBUTING.md](CONTRIBUTING.md). O E2E roda contra o build e intercepta os três provedores: nenhuma chamada real sai nem é preciso uma chave.

## Documentação

- [`@lavra/pii-br`](packages/pii-br/README.md): biblioteca de detecção e máscara de dados pessoais brasileiros
- [Base legal dos modelos de ata](docs/base-legal.md): norma, artigo ou item, link oficial e data de consulta de cada texto fixo
- [Spike de conectividade](docs/spike-conectividade.md): o que foi verificado com cada provedor
- [Documento de design](docs/superpowers/specs/2026-10-20-lavra-design.md)
- [Roteiro de implementação](docs/superpowers/plans/2026-10-20-00-roteiro.md)
- [Como contribuir](CONTRIBUTING.md) · [Código de conduta](CODE_OF_CONDUCT.md) · [Segurança](SECURITY.md)

## Licença

[MIT](LICENSE) © 2026 Diego Antunes
