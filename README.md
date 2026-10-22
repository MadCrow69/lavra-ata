# Lavra

Gerador de atas de reunião brasileiras a partir da transcrição, direto no navegador: sem servidor, com a sua própria chave de IA e com os dados pessoais mascarados antes de qualquer envio.

[English](README.en.md)

![Demonstração do Lavra: o exemplo de reunião corporativa abre com a ata pronta; a prévia "O que vai para a IA" mostra lado a lado o CPF original e o marcador [CPF_1] que vai no lugar dele; ao fim, o PDF da ata é baixado.](docs/demo.gif)

**Experimente: https://madcrow69.github.io/lavra-ata/** — o botão "Ver exemplo" abre uma ata pronta de cada tipo, sem pedir chave e sem enviar nada para IA.

## Como funciona

1. Você informa a **sua chave de API** (OpenAI, Google Gemini ou Anthropic), preenche os dados da reunião e os participantes e cola a transcrição. Se a transcrição traz quem falou (falas "Nome: fala" ou as marcas `<v Nome>` do `.vtt`), o app sugere essas pessoas como participantes; com o `.vtt`, sugere também o término a partir do início e da duração da gravação. Nada entra sem o seu clique.
2. O app **mascara os identificadores pessoais** (CPF, CNPJ, telefone, e-mail, cartão etc.) com [`@lavra/pii-br`](packages/pii-br/README.md) e mostra, antes do envio, o que vai para a IA ("Original" × "Enviado à IA").
3. A chamada vai **direto do navegador ao provedor**, sem passar por servidor do Lavra. Se um provedor falhar, o app tenta o próximo da sua lista de prioridade e registra a troca na seção (ex.: "Gerado por Gemini · gemini-3.8-flash — OpenAI falhou (limite de uso)").
4. A IA devolve JSON validado por schema; o app põe os dados originais de volta **neste navegador** e monta a ata em uma folha A4, em texto puro (nunca HTML vindo da IA). Você revisa seção por seção: edita à mão, regera ou ajusta com uma instrução.
5. Com a ata revisada, você **baixa em PDF ou DOCX** (com a sua logo no cabeçalho, se quiser) ou copia as tarefas agrupadas por responsável.

Pontos de projeto:

- **A IA só escreve o que só a transcrição sabe.** Cabeçalho, lista de presença, tabelas de participantes, assinaturas, fecho e aviso de minuta vêm do formulário e do modelo de ata, nunca da IA; ela não consegue inventar presença, mesa ou data.
- **Chave só em memória** por padrão; ela só vai para o `localStorage` se você marcar "Lembrar neste navegador". Nunca vai para URL, rascunho ou mensagem de erro.
- **Modelos padrão econômicos** (o menor de cada provedor: `gpt-6-luna`, `gemini-3.8-flash`, `claude-haiku-5-5`); você troca no modal de chaves.
- **Unidade, fração ideal e participação no capital não vão para a IA.** Esses campos (condomínio e sócios de Ltda) ficam neste navegador e só entram no documento.
- **Rascunho na sessão** (`sessionStorage`): recarregar a aba recupera o formulário; a transcrição e a ata gerada não vão para o `localStorage`.
- **Logo e preferências só por opção.** A logo e as preferências (uma lista fechada de campos: tipo de ata, tom, cor de destaque, ordem e modelo dos provedores; nunca transcrição, ata, participantes nem chave) só vão para o `localStorage` se você marcar "Lembrar logo neste navegador" ou "Lembrar preferências neste navegador".
- **PDF e DOCX nascem no navegador, sem rede.** Os geradores ([pdfmake](https://pdfmake.github.io/docs/) e [docx](https://docx.js.org/), ambos MIT) só são carregados no primeiro clique em "Baixar", da mesma origem do site; as fontes ([Inter](https://fontsource.org/fonts/inter) e [Source Serif 4](https://fontsource.org/fonts/source-serif-4), sob a [SIL Open Font License 1.1](https://openfontlicense.org/)) vão embutidas no app, sem CDN.
- **A logo nunca vai para a IA.** PNG, JPEG, WebP ou SVG (até 2 MB), conferido pelo conteúdo antes de decodificar; o SVG sempre vira PNG e nunca entra como marcação.
- **Antes de baixar, o app avisa** se restam campos `[PREENCHER]`, se há um editor de seção aberto e, no PDF, quais caracteres as fontes embutidas não desenham.

## Privacidade: como verificar

Você não precisa confiar no texto acima: dá para conferir no próprio navegador. O app tem esta mesma página no botão "Privacidade: como verificar", no cabeçalho.

**O que sai do navegador.** Somente as chamadas aos provedores de IA que você cadastrou, na ordem da sua lista, com a transcrição já mascarada. Nenhum servidor do Lavra recebe nada. Os únicos endereços permitidos são `api.openai.com`, `generativelanguage.googleapis.com` e `api.anthropic.com`.

**Confira na aba Rede.**

1. Abra as ferramentas do desenvolvedor: <kbd>F12</kbd> ou <kbd>Ctrl+Shift+I</kbd> (no Mac, <kbd>Cmd+Option+I</kbd>).
2. Vá à aba Rede (Network) e recarregue a página.
3. Filtre por Fetch/XHR.
4. Gere uma ata: só aparecem chamadas a `api.openai.com`, `generativelanguage.googleapis.com` ou `api.anthropic.com`, na ordem da sua lista.
5. Abra a chamada e veja o conteúdo enviado (Payload): no lugar de CPF, telefone e e-mail aparecem marcadores como `[CPF_1]`.

**Confira a política de segurança (CSP).** Na aba Elementos, dentro de `<head>`, a tag `<meta http-equiv="Content-Security-Policy">` lista os destinos permitidos em `connect-src`; o próprio navegador bloqueia qualquer outro. A política tem `script-src 'self'` e `style-src 'self'`, sem `unsafe-inline` nem `unsafe-eval`; ela vem de uma definição única, e o build confere o HTML gerado contra essa definição e falha se não bater.

**Confira o código desta versão.** O rodapé do site mostra o hash do commit que gerou a publicação, com link para ele; "Privacidade: como verificar" aponta para o código daquele mesmo commit. O site é publicado pelo GitHub Actions a partir da `main`.

- Adaptadores de IA (as chamadas aos provedores): [`apps/web/src/ai/providers`](apps/web/src/ai/providers)
- Biblioteca de detecção e máscara: [`packages/pii-br/src`](packages/pii-br/src)
- Definição da CSP: [`apps/web/csp.config.js`](apps/web/csp.config.js)
- Workflow que publica o site: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

**O que não é protegido.**

- Nomes de pessoas não são mascarados — a ata precisa deles.
- Informação sensível escrita em linguagem natural (um diagnóstico, um endereço, uma opinião) vai como está.
- O que é enviado fica sob os termos do provedor que você escolheu.
- Uma extensão do navegador com acesso à página pode ler a chave e o texto (veja o [modelo de ameaças](SECURITY.md)).
- O modo exemplo não envia nada para IA: o exemplo já vem pronto no site. Só o "Testar" do modal de chaves, se você clicar nele, fala com o provedor, para conferir a sua chave, sem nada do exemplo.

## Tipos de ata e base legal

- **Reunião corporativa:** reunião de trabalho de uma empresa, equipe ou comitê; sem exigência legal de forma.
- **CIPA:** reunião ordinária ou extraordinária da Comissão Interna de Prevenção de Acidentes e de Assédio, com representação e condição dos participantes (NR-5; Lei nº 14.457/2022, art. 23).
- **Condomínio:** assembleia geral ordinária ou extraordinária, presencial, eletrônica ou híbrida, com unidade, vínculo e fração ideal de cada condômino (Código Civil, arts. 1.334 e 1.350 a 1.355; Lei nº 4.591/1964).
- **Sócios de Ltda:** reunião ou assembleia de sócios, com participação informada no capital e representação por procurador (Código Civil, arts. 1.072 a 1.080-A; Manual de Registro de Sociedade Limitada do DREI).

Cada texto fixo dos modelos de CIPA, condomínio e Ltda aponta para o artigo ou item da norma, com link oficial e data de consulta, em [`docs/base-legal.md`](docs/base-legal.md); um teste automatizado reprova texto fixo sem linha lá. **O app não calcula quórum, fração ideal nem validade de deliberação:** votos e quórum entram na ata só como foram declarados na reunião, e o que não foi dito sai como `[PREENCHER: …]`. Na ata de Ltda, a única conta é a soma das participações informadas dos sócios presentes, exibida como "capital presente informado".

## Rodar localmente

Requer [pnpm](https://pnpm.io/installation); o Node 24 é provisionado pelo próprio projeto.

```bash
pnpm install
pnpm --filter @lavra/web dev       # servidor de desenvolvimento em http://localhost:5173/lavra-ata/
pnpm test                          # testes unitários (Vitest, no máximo 4 workers)
```

Para ver o build com a CSP ativa (o servidor de desenvolvimento não a injeta):

```bash
pnpm build
pnpm --filter @lavra/web preview   # http://localhost:4173/lavra-ata/
```

O app exige **contexto seguro** (HTTPS ou `localhost`): ele usa `crypto.randomUUID` e a área de transferência, que o navegador só libera nesses contextos. Aberto por um IP da rede local em HTTP, o app mostra um aviso explicando o motivo.

O E2E (`pnpm --filter @lavra/web e2e`) roda contra o build e intercepta os três provedores: nenhuma chamada real sai nem é preciso uma chave. O restante do fluxo de contribuição está em [CONTRIBUTING.md](CONTRIBUTING.md).

## Arquitetura

Monorepo pnpm com dois pacotes: [`apps/web`](apps/web) (o app: Vite, React e TypeScript, site estático) e [`packages/pii-br`](packages/pii-br/README.md) (a biblioteca de dados pessoais brasileiros, em TypeScript e sem dependências). O fluxo de uma geração:

```text
transcrição ──► pii-br: mascara ──► texto com [CPF_1], [EMAIL_1]… ──► provedor de IA (fetch direto do navegador)
                     │                                                        │
                     └── mapa marcador → original (só em memória)             ▼
formulário (dados, participantes) ─────────────────────────────► JSON validado por schema
                                                                              │
          pii-br: confere a saída e devolve os originais ──► modelo da ata ──► folha / PDF / DOCX
```

- **Sem backend:** o site é estático (GitHub Pages) e as únicas conexões são as do navegador aos três provedores.
- **CSP em `<meta>`** (o GitHub Pages não permite cabeçalhos próprios), gerada de uma fonte única e conferida no build; o E2E roda contra o build com a CSP ativa e reprova qualquer requisição a outro host ou violação da política.
- **Exportação local:** PDF e DOCX são montados no navegador, a partir do mesmo modelo da folha.
- **Qualidade no CI:** formatação, lint, tipos, testes com cobertura, build, auditoria de dependências e E2E em todo PR; CodeQL e OpenSSF Scorecard. Em 22/10/2026: 2.160 testes unitários (Vitest) e 43 testes E2E (Playwright).

## Limitações

- **Nomes de pessoas não são mascarados.** A ata precisa deles; a biblioteca mascara só identificadores com formato próprio (documentos, contatos, cartão). Isto não é anonimização.
- **Toda ata é minuta.** Os modelos de ata foram redigidos com base na legislação citada, **sem revisão de profissional da área** (a base de cada texto fixo está em [`docs/base-legal.md`](docs/base-legal.md)). Contribuições de advogados e técnicos são bem-vindas ([Como contribuir](CONTRIBUTING.md)).
- **OpenAI direto do navegador:** funciona (verificado no [spike de conectividade](docs/spike-conectividade.md)), mas a OpenAI não suporta oficialmente essa chamada, e o CORS já quebrou antes (out/2025 e jan/2026, segundo a pesquisa registrada no [documento de design](docs/superpowers/specs/2026-10-20-lavra-design.md)). A lista de prioridade de provedores é a proteção contra uma nova quebra.
- **Adaptador da Anthropic não verificado com chamada real.** Foi construído pela documentação e é testado com respostas interceptadas; a conta usada nos testes está sem crédito. OpenAI e Gemini foram verificados no spike.
- **A chave da Anthropic precisa estar ligada a um workspace.** Chaves de escopo "Organização" exigem o cabeçalho `anthropic-workspace-id`, que o app não envia; nesse caso o app avisa e pede uma chave criada dentro de um workspace.
- **PDF conferido em partes.** Na ata corporativa, verificado abrindo PDFs de 200 participantes e 200 encaminhamentos no visualizador do Chromium; nas atas de CIPA, condomínio (200 condôminos) e sócios de Ltda, conferido pelo texto extraído ("Página X de Y" em todas as páginas) e pela primeira e última página renderizadas, não no visualizador.
- **DOCX: tipografia não conferida.** As fontes não vão embutidas no DOCX e o Word as troca por substitutas. O layout foi conferido pelo XML (cabeçalho de tabela repetido, linhas que não se partem, numeração de página e imagem) e, nas atas de CIPA, condomínio e sócios de Ltda, abrindo os arquivos no Microsoft Word: ali se conferiram grade, colunas, quebras de página e assinaturas, não a tipografia. O DOCX da ata corporativa e a logo no Word seguem conferidos só pelo XML; o LibreOffice não foi testado.
- **Sugestão de participantes só acha quem falou com nome.** No texto colado ou `.txt`, só vale a linha que começa por "Nome:" com até 5 palavras, só letras (sem dígito, vírgula ou parênteses). No `.vtt`, o nome da marca `<v>` vale como escrito ("Souza, Ana" não é reordenado; só sai um sufixo de convidado como "(Convidado)"). Quem participou sem falar, rótulos genéricos ("Speaker 1", "Desconhecido") e rótulos de campo ("Assunto:", "Pauta:") não são sugeridos.
- **Tarefas por responsável** agrupam só ignorando espaço, caixa e forma Unicode: "Ana" e "Ana Souza" continuam sendo pessoas diferentes.

## Roadmap

- Contratos e outros documentos além de atas.
- Transcrição de áudio.
- Atas de S.A. (assembleia geral e conselho de administração).
- Interface em inglês.
- Publicar `@lavra/pii-br` no npm.

## Documentação

- [`@lavra/pii-br`](packages/pii-br/README.md): biblioteca de detecção e máscara de dados pessoais brasileiros
- [Base legal dos modelos de ata](docs/base-legal.md): norma, artigo ou item, link oficial e data de consulta de cada texto fixo
- [Spike de conectividade](docs/spike-conectividade.md): o que foi verificado com cada provedor
- [Documento de design](docs/superpowers/specs/2026-10-20-lavra-design.md)
- [Roteiro de implementação](docs/superpowers/plans/2026-10-20-00-roteiro.md)
- [Como contribuir](CONTRIBUTING.md) · [Código de conduta](CODE_OF_CONDUCT.md) · [Segurança](SECURITY.md)

## Licença

[MIT](LICENSE) © 2026 Diego Antunes

Feito por [Diego Antunes](https://www.linkedin.com/in/diego-ozorio-antunes/).
