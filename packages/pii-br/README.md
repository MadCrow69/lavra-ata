# @lavra/pii-br

Biblioteca TypeScript, sem dependências, que **detecta e mascara identificadores pessoais brasileiros** (CPF, CNPJ, telefone, e-mail, CEP, placa, PIS/PASEP/NIT, RG e cartão) antes de um texto sair do navegador, e que **reidrata** o resultado depois. Roda no navegador e no Node, em ESM, e faz parte do [Lavra](../../README.md), um gerador de atas de reunião que mascara os dados antes de qualquer envio a um modelo de IA.

> **Isto não é anonimização.** A biblioteca só reconhece identificadores com formato próprio. **Nomes de pessoas, endereços, datas e informação sensível em texto livre ("fulano foi afastado por depressão") não são detectados** e seguem no texto. Isso é deliberado: uma ata precisa dos nomes para fazer sentido. O que se mascara é o que permite identificar ou fraudar alguém por si só (documentos, contatos, cartão), não quem fez ou disse o quê.

## O que detecta

| Tipo       | Formatos aceitos                                                                                                                                                                          | Validação                                                                                                                       | Palavras de contexto                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `CPF`      | `000.000.000-00`, colado, parcialmente pontuado, separadores mistos (`529.982.247 - 25`, `529,982,247-25`) e 11 dígitos com espaços (**só com contexto**)                                 | DV (módulo 11). Totalmente pontuado é mascarado mesmo com DV inválido; **a palavra de contexto substitui o DV válido**          | `cpf`                                                                                                        |
| `CNPJ`     | numérico e **alfanumérico** (vigente desde jul/2026), pontuado, colado, parcial ou com separadores mistos (`11.222.333/0001 - 81`); letras em minúsculas; com espaços **só com contexto** | DV (módulo 11, valor do caractere = ASCII − 48). Totalmente pontuado dispensa; **a palavra de contexto substitui o DV válido**  | `cnpj`                                                                                                       |
| `EMAIL`    | `local@dominio.tld`, com plus-addressing, subdomínios e letras Unicode (`josé@exemplo.com`)                                                                                               | formato                                                                                                                         | não usa                                                                                                      |
| `TELEFONE` | fixo e celular, com ou sem `+55`, DDD, parênteses, hífen, espaços; local sem DDD: `98765-4321` (com traço) **sempre**; `98765 4321` (com espaço) e `3333-4444` **só com contexto**        | formato; número sem formatação só como celular (`DDD` + `9` + 8 dígitos)                                                        | `telefone`, `fone`, `tel`, `cel`, `celular`, `whatsapp`, `zap`, `contato`, `ligue`, `ligar`, `número`, `num` |
| `CEP`      | `00.000-000`, `00000-000`, `00000000`                                                                                                                                                     | formato; só com dígitos exige contexto                                                                                          | `cep`                                                                                                        |
| `PLACA`    | Mercosul `AAA0A00`; antiga `AAA-0000`, `AAA0000`, `AAA 0000`                                                                                                                              | formato; antiga (e Mercosul fora de caixa alta) exige contexto                                                                  | `placa`, `veículo`, `carro`, `moto`, `caminhão` (singular e plural)                                          |
| `PIS`      | `000.00000.00-0`, colado, parcial ou com separadores mistos (`120.55445.81 - 4`); com espaços **só com contexto** (PIS/PASEP/NIT)                                                         | DV (pesos 3,2,9,8,7,6,5,4,3,2). Totalmente pontuado é aceito mesmo com DV ruim; **a palavra de contexto substitui o DV válido** | `pis`, `pasep`, `nit`, `nis` (janela de 60 caracteres)                                                       |
| `RG`       | sem padrão nacional: `12.345.678-9`, `12345678`, `MG12345678`, com `X` final                                                                                                              | nenhuma. **Só com contexto**                                                                                                    | `rg`, `identidade`, `registro geral` (janela de 60 caracteres)                                               |
| `CARTAO`   | 13 a 19 dígitos: grupos `4-4-4-4`, `4-6-5`, `4-6-4`, `4-4-4-1` (hífen, espaço ou ponto) ou colado                                                                                         | Luhn, sempre (dígitos todos iguais são rejeitados); **contexto não dispensa**                                                   | não usa                                                                                                      |

- **Contexto** é uma palavra de rótulo isolada (sem acento nem distinção de caixa) nos 25 caracteres que antecedem o número (60 para `RG` e `PIS`, cujo rótulo costuma vir antes de um nome completo): `CPF 52998224725` casa, `comunitário 12345678901` não casa em `nit`.
- Cada achado traz `valid`: `true` quando os dígitos verificadores conferem (ou o tipo não os tem). Um CPF totalmente pontuado com DV errado é mascarado mesmo assim, com `valid: false`: na dúvida, mascara.
- Linhas de serviço (`0800`, `0300`) não são tratadas como telefone de pessoa.

## Uso

```ts
import { createMaskMap, mask, unmask, validateOutput } from '@lavra/pii-br';

const transcricao =
  'O associado CPF 529.982.247-25 (tel. (11) 98888-7777) pediu a segunda via. ' +
  'Contato: ana@exemplo.com.br.';

// 1. Mascarar. O mapa fica na memória do navegador; só o texto mascarado sai.
const { masked, map, collisions } = mask(transcricao, { map: createMaskMap() });
if (collisions.length > 0) avisarUsuario(collisions); // veja "literais com forma de marcador" abaixo
// masked: 'O associado CPF [CPF_1] (tel. [TELEFONE_1]) pediu a segunda via. Contato: [EMAIL_1].'

// 2. Enviar `masked` ao modelo de IA (`chamarModelo` e `avisarUsuario` são da aplicação).
const saida = await chamarModelo(masked);

// 3. Conferir a saída ANTES de reidratar.
const relatorio = validateOutput(saida, map, masked);
if (!relatorio.ok) {
  // relatorio.unknownMarkers   -> marcadores que o modelo inventou ([CPF_9])
  // relatorio.malformedMarkers -> marcadores que existem, mas vieram alterados ([CPF 1], [cpf_1])
  //                               ou quebrados de um jeito que o unmask não restaura (CPF_1, (CPF_1), [CPF__1])
  // relatorio.newIdentifiers   -> CPF/telefone/etc. na saída que não estavam no que foi enviado
}

// 4. Reidratar.
const final = unmask(saida, map);
```

> **Atenção: passe sempre o texto SEM máscara para `mask`.** Nunca remascare um texto que ainda contém marcadores (`[CPF_1]`): com o mapa reaproveitado, os marcadores existentes colidem com os novos e viram `[CPF#1]` (listados em `collisions`), e sem o mapa viram literais do usuário que o `unmask` não restaura. Para regerar ou ajustar, mascare de novo o **original** reaproveitando o mapa (`mask(original, { map })`).

Pontos que importam:

- **`validateOutput` recebe o texto mascarado que foi realmente enviado** (transcrição, instruções e qualquer contexto), não o original. Com o original, um CPF cru que vazasse na saída pareceria "já presente na entrada" e passaria despercebido.
- **O mesmo valor recebe sempre o mesmo marcador.** A comparação usa o valor normalizado: `529.982.247-25` e `52998224725` são o mesmo `[CPF_1]`. `unmask` restaura o **primeiro formato visto** (o que está em `map.markers`), não o de cada ocorrência.
- **`MaskMap` é JSON puro** (`JSON.stringify` / `JSON.parse`) e pode ser reaproveitado entre chamadas (`mask(texto, { map })`), por exemplo ao regerar ou ajustar uma seção. `mask` não altera o mapa recebido: devolve um novo.
- **Um mapa por linhagem de documento.** Só chame `unmask` com o mapa que produziu o texto mascarado (ou um descendente dele). Com outro mapa, `[CPF_1]` pode apontar para o CPF de outra pessoa, e a biblioteca não tem como perceber.
- **Marcadores desconhecidos ficam como estão** no `unmask`. A reidratação aceita variações de grafia que modelos costumam produzir (`[cpf_1]`, `[CPF 1]`, `[ CPF-1 ]`); `validateOutput` as reporta como `malformedMarkers`. O escape de markdown `[CPF\_1]` também é restaurado. Sobras que o `unmask` **não** restaura (`CPF_1`, `[CPF_1`, `(CPF_1)`, `[CPF__1]`, `[CPF_ 1]`) são reportadas como `malformedMarkers` e reprovam a saída: o nome do tipo seguido de um número do mapa, ou colado em `[`, `]`, `_` ou `\`. Prosa como "o CEP 01310100" não reprova; já "CPF 1" com `[CPF_1]` no mapa reprova (sobre-sinalizar é aceitável).
- **Literais com forma de marcador escritos pelo usuário** (`[CPF_1]` já presente na transcrição) não podem ser confundidos com os gerados:
  - os números que o usuário escreveu ficam **reservados** (`map.reserved`) e nunca são alocados, então a numeração pode ter saltos (`[CPF_2]` antes de `[CPF_1]` existir) e `unmask` deixa o literal como está;
  - se o literal colide com um marcador **já alocado** no mapa reutilizado, é reescrito como `[CPF#1]` (visível, não casa com `unmask`) e listado em `collisions`. A aplicação deve avisar o usuário.
- `detect(texto, { types: ['CPF', 'CNPJ'] })` e `mask(texto, { types })` restringem os tipos.

### API pública

`detect`, `mask`, `unmask`, `createMaskMap`, `validateOutput`, `findMarkers`, `MARKER_PATTERN`, os validadores `isValidCpf`, `isValidCnpj`, `isValidPis`, `isValidLuhn` e os tipos `PiiType`, `Finding`, `DetectOptions`, `MaskMap`, `OutputReport`, `MaskResult`, `MarkerMatch`. Os detectores individuais são internos.

`findMarkers(texto)` devolve `{ type, number, raw, start, end }[]` com os marcadores dos 9 tipos, na mesma forma tolerante do `unmask` (é o caminho recomendado para a prévia de privacidade da app). `MARKER_PATTERN` é só a forma **canônica e estrita** (`[CPF_1]`), e é uma regex **global**: clone-a antes de usar (`new RegExp(MARKER_PATTERN.source, 'g')`).

## Decisões de projeto

- **Privacidade primeiro: na dúvida, mascara.** Achados que se sobrepõem viram a **união** dos trechos (nenhum pedaço fica de fora); um grupo de 3 a 4 dígitos ligado ao cartão (CVV) entra no mesmo marcador; a presença de contexto prevalece sobre a ausência de DV válido. O custo é aceitar falsos positivos (veja abaixo).
- **Precedência e união em sobreposição.** Quando dois detectores acham o mesmo trecho, vence o de maior precedência: `EMAIL` > `CNPJ` > `CPF` > `PIS` > `CARTAO` > `TELEFONE` > `CEP` > `PLACA` > `RG` (11 dígitos válidos como CPF e como PIS viram `CPF`). Os candidatos são avaliados por início, depois trecho mais longo, depois precedência; o primeiro define tipo e `valid`. Quem fica contido nele é descartado e quem o ultrapassa em parte **estende** o trecho (união): nenhum pedaço fica de fora.
- **Traços e espaços tipográficos** (meia-risca, hífen tipográfico, espaço sem quebra, espaços de largura fixa U+2002 a U+200A e U+205F, vindos de editores e transcrições) são normalizados 1:1 antes da varredura, então os deslocamentos `start`/`end` continuam valendo no texto original.
- **Expressões regulares limitadas.** Nos detectores, nenhuma repetição ilimitada em separadores, para não abrir espaço a backtracking catastrófico (ReDoS) em texto colado. Um teste de desempenho varre entradas patológicas de 50 mil caracteres e falha acima de 1 s por detector (2 s no `detect` completo); o pior caso medido foi de dezenas de milissegundos por detector em entradas patológicas de 50 mil caracteres.
- **Zero dependências de runtime.** Sem `Buffer`, `fs` ou `crypto` do Node: o mesmo código roda no navegador e no Node.
- **Falha fechada.** Um trecho que não confirma a estrutura esperada é rejeitado, nunca avaliado às cegas.

## Limitações conhecidas

- **Não é anonimização** (veja o topo): nomes, endereços, datas e informação sensível em texto livre passam.
- **Falsos positivos assumidos**, por escolha de privacidade:
  - celular local com traço mesmo sem rótulo: `pedido 98765-4321` é mascarado como telefone;
  - número de 13 a 19 dígitos que passa no Luhn (cerca de um em dez, por acaso) é mascarado como cartão;
  - um ano colado logo depois do cartão (`4111 1111 1111 1111 2026`) é engolido junto como se fosse o CVV;
  - CPF totalmente pontuado é mascarado ainda que o DV não confira;
  - valor em reais cujos 11 dígitos formam um CPF válido (`R$ 529.982.247,25`) é mascarado; com DV inválido (`R$ 529.982.247,26`) e sem rótulo, segue como está, assim como listas de números soltos na prosa.
- **Falsos negativos conhecidos**: placa real que coincida com mês e ano (`JUN-2023`) fica sem máscara; CEP só com dígitos e RG sem a palavra de contexto por perto não são reconhecidos; linhas de serviço (`0800`) são ignoradas de propósito.
- **E-mails internacionalizados** (IDN) têm suporte parcial: letras Unicode no local e no domínio, mas domínio com TLD em Punycode (`xn--...`) casa só em parte.
- **RG não tem padrão nacional** (varia por estado e emissor, sem DV público): só é detectado com contexto, e números curtos ou longos demais podem escapar.
- Um identificador partido por quebra de linha no meio não é reconhecido.

## Testes

```bash
pnpm --filter @lavra/pii-br test   # testes do pacote
pnpm test:ci                       # na raiz: testes + cobertura (mínimo de 95% em linhas, branches, funções e statements)
```

O limite de cobertura fica na configuração raiz do Vitest ([`vitest.config.ts`](../../vitest.config.ts)): no modo `projects` só ela vale, e é o que o CI executa. Todos os dados de teste são fictícios.

## Licença

[MIT](../../LICENSE) © 2026 Diego Antunes
