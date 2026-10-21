# Spike de conectividade com os provedores de IA

Data: 2026-10-21 · Executado pelo autor, no navegador, com as próprias chaves, a partir de uma página local com a mesma CSP do app (`connect-src` restrito aos três provedores). Nenhuma chave foi registrada aqui.

## Objetivo

Confirmar, antes de construir o app, que cada provedor aceita chamada **direta do navegador** (CORS) e devolve **JSON validado por schema** — requisito do design (site estático, sem backend).

Pedido de teste igual para os três: devolver `idioma = "pt-BR"` e uma lista com duas cores, com schema `{ idioma: string, cores: string[] }` e `additionalProperties: false`.

## Resultado

| Provedor  | CORS do navegador                     | Testar chave                  | JSON estruturado                                                                                                                                                                                                                           | Situação                        |
| --------- | ------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| OpenAI    | ✅ (requisições chegaram ao servidor) | ✅ `GET /v1/models` → 200     | ⚠️ `POST /v1/responses` → 400: `reasoning.effort: "minimal"` não é aceito por `gpt-6-luna` (aceitos: `none`, `low`, `medium`, `high`, `xhigh`, `max`)                                                                                      | Repetir com `none`              |
| Gemini    | ✅                                    | ✅ `GET /v1beta/models` → 200 | ✅ `generateContent` + `responseMimeType: application/json` + `responseJsonSchema`, modelo `gemini-3.8-flash`, `finishReason: STOP`, validação local ok. ⚠️ Interactions API → 400: `thinking_level: minimal` não é aceito por esse modelo | Funciona                        |
| Anthropic | ✅ (requisições chegaram ao servidor) | ✅ `GET /v1/models` → 200     | ⚠️ `POST /v1/messages` → 400: conta sem crédito                                                                                                                                                                                            | Não verificado com chamada real |

## Conclusões para o Plano 03

1. **Os três provedores aceitam chamada direta do navegador** com a CSP do app. A arquitetura sem backend está confirmada.
2. **Gemini:** usar `generateContent` com `responseJsonSchema` (verificado). O "raciocínio" consumiu 276 tokens numa resposta de 14 — confirma que o teto de saída precisa de folga e que o nível de raciocínio deve ser o mais baixo **aceito pelo modelo** (varia por modelo: `minimal` foi recusado na Interactions API).
3. **OpenAI:** usar a Responses API com `text.format` `json_schema` estrito; o esforço de raciocínio padrão do adaptador passa a ser `none` (o menor aceito pelo `gpt-6-luna`). Pendente: confirmar o JSON com `none`.
4. **Anthropic:** CORS confirmado; saída estruturada (`output_config.format`) fica **não verificada com chamada real** até haver crédito na conta. O adaptador será construído pela documentação e testado com resposta interceptada, e o README dirá isso.
5. **Lição de design:** os valores aceitos de esforço/nível de raciocínio mudam por modelo. O adaptador não pode chumbar um valor: cada modelo da lista configurável declara o seu, e um erro `400` de valor não suportado vira mensagem clara para a pessoa (com sugestão de outro modelo), nunca falha muda.
