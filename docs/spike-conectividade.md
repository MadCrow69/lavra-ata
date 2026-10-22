# Spike de conectividade com os provedores de IA

Data: 2026-10-21 · Executado pelo autor, no navegador, com as próprias chaves, a partir de uma página local com a mesma CSP do app (`connect-src` restrito aos três provedores). Nenhuma chave foi registrada aqui. A OpenAI foi repetida depois, com `reasoning.effort: "none"` (veja abaixo).

## Objetivo

Confirmar, antes de construir o app, que cada provedor aceita chamada **direta do navegador** (CORS) e devolve **JSON validado por schema** — requisito do design (site estático, sem backend).

Pedido de teste igual para os três: devolver `idioma = "pt-BR"` e uma lista com duas cores, com schema `{ idioma: string, cores: string[] }` e `additionalProperties: false`.

## Resultado

| Provedor  | CORS do navegador                     | Testar chave                  | JSON estruturado                                                                                                                                                                                                                                    | Situação                                      |
| --------- | ------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| OpenAI    | ✅ (requisições chegaram ao servidor) | ✅ `GET /v1/models` → 200     | ✅ `POST /v1/responses` com `reasoning.effort: "none"` → 200, JSON válido pelo schema, modelo `gpt-6-luna`. (Na primeira rodada, `effort: "minimal"` → 400: não é aceito por esse modelo; aceitos: `none`, `low`, `medium`, `high`, `xhigh`, `max`) | Funciona (com `none`)                         |
| Gemini    | ✅                                    | ✅ `GET /v1beta/models` → 200 | ✅ `generateContent` + `responseMimeType: application/json` + `responseJsonSchema`, modelo `gemini-3.8-flash`, `finishReason: STOP`, validação local ok. ⚠️ Interactions API → 400: `thinking_level: minimal` não é aceito por esse modelo          | Funciona                                      |
| Anthropic | ✅ (requisições chegaram ao servidor) | ✅ `GET /v1/models` → 200     | ⚠️ `POST /v1/messages` → 400: conta sem crédito                                                                                                                                                                                                     | Verificado em 22/10/2026 (veja a nota abaixo) |

## Conclusões para o Plano 03

1. **Os três provedores aceitam chamada direta do navegador** com a CSP do app. A arquitetura sem backend está confirmada.
2. **Gemini:** usar `generateContent` com `responseJsonSchema` (verificado). O "raciocínio" consumiu 276 tokens numa resposta de 14 — confirma que o teto de saída precisa de folga e que o nível de raciocínio deve ser o mais baixo **aceito pelo modelo** (varia por modelo: `minimal` foi recusado na Interactions API).
3. **OpenAI:** a Responses API com `text.format` `json_schema` estrito e `reasoning: { effort: "none" }` foi **verificada** (200 OK, JSON válido), executada pelo autor. O adaptador usa `none` para o `gpt-6-luna` e envia `store: false`, que pede à OpenAI que não armazene a resposta. `store: false` foi adotado por decisão de privacidade; **não** fez parte do pedido do spike (o que foi verificado é a chamada com `none`).
4. **Anthropic:** CORS confirmado; no spike, a saída estruturada (`output_config.format`) não pôde ser verificada porque a conta estava sem crédito. O adaptador foi construído pela documentação e testado com resposta interceptada (testes unitários e E2E). Verificado depois com chamada real: veja a nota de 22/10/2026.
5. **Lição de design:** os valores aceitos de esforço/nível de raciocínio mudam por modelo. O adaptador não pode chumbar um valor: cada modelo da lista configurável declara o seu, e um erro `400` de valor não suportado vira mensagem clara para a pessoa (com sugestão de outro modelo), nunca falha muda.

## Nota de 22/10/2026: os três provedores verificados com chamada real

Executado no app (build de desenvolvimento), no navegador, com uma transcrição `.vtt` colada no campo e convertida, as pessoas que falaram sugeridas e adicionadas, e o término sugerido. Nenhuma chave nem dado da reunião foi registrado aqui.

| Provedor  | Chamada                                  | Resultado no app                          |
| --------- | ---------------------------------------- | ----------------------------------------- |
| Gemini    | `POST …:generateContent` → 200 (uma vez) | "Gerado por Gemini · gemini-3.8-flash"    |
| OpenAI    | `POST /v1/responses` → 200 (uma vez)     | "Gerado por OpenAI · gpt-6-luna"          |
| Anthropic | `POST /v1/messages` → 200 (uma vez)      | "Gerado por Anthropic · claude-haiku-5-5" |

- A aba Rede mostrou só os três hosts dos provedores.
- **Anthropic:** verificada com uma chave **ligada a um workspace**. Chaves de escopo "Organização" exigem o cabeçalho `anthropic-workspace-id`, que o app não envia; nesse caso a API responde 400 e o app explica a causa e pede uma chave criada dentro de um workspace.
