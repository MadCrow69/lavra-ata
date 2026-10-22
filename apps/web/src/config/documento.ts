/** Textos fixos do documento (folha A4 e, no Plano 04, PDF e DOCX). Fonte única. */

/** Aviso de minuta impresso no fim de toda ata (spec 7.4). */
export const AVISO_MINUTA =
  'Minuta elaborada com auxílio de inteligência artificial a partir de transcrição. Revise integralmente antes de assinar. Não substitui assessoria jurídica; a validade depende de convocação, quórum e assinaturas, que não foram verificados.';

/** Aparece no lugar das seções enquanto a ata não foi gerada. */
export const TEXTO_SECOES_PENDENTES = 'As seções aparecem aqui depois de gerar a ata.';

/**
 * Rodapé paginado. `{pagina}` e `{total}` são trocados pelos renderizadores paginados (PDF e
 * DOCX); a folha em HTML é contínua e não o exibe.
 */
export const RODAPE_PAGINADO = 'Página {pagina} de {total}';

/** Título da seção de encaminhamentos (folha, documentos e prompt da IA). */
export const TITULO_ENCAMINHAMENTOS = 'Encaminhamentos';

/**
 * Abre o rodapé interno da folha em tela, seguido dos provedores e modelos que geraram as seções
 * (spec 8.1.1). Só na tela: PDF e DOCX não o imprimem.
 */
export const RODAPE_INTERNO_IA = 'Minuta gerada com auxílio de IA';

/** Texto da célula quando o dado não foi informado (nome, cargo, prazo…). */
export const CELULA_VAZIA = '—';

/** Larguras (%) das colunas da tabela de encaminhamentos: Ação · Responsável · Prazo · Status. */
export const LARGURAS_ENCAMINHAMENTOS = [50, 20, 15, 15] as const;

/**
 * Peso de cada coluna da tabela de participantes (proporção entre elas; vira a largura em % por
 * `largurasPorPeso`). `extra` é o padrão de um campo de participante sem `peso` próprio.
 */
export const PESOS_COLUNA = { nome: 3, papel: 2, extra: 1.5, presenca: 2 } as const;

/** Responsável do encaminhamento quando a transcrição não deixa claro quem fará. */
export const RESPONSAVEL_A_DEFINIR = 'A definir';

/** Página A4 do PDF e do DOCX (pt). Fonte única para os dois formatos. */
export const PAGINA_DOCUMENTO = { margemPt: 56, margemInferiorPt: 64 } as const;

/** Tamanho do A4 (210 × 297 mm) em pt. O DOCX o converte para os vinte avos de ponto do Word. */
export const A4_PT = { largura: 595.28, altura: 841.89 } as const;

/** Largura da área de texto (pt): a página menos as duas margens laterais. Derivada, nunca literal. */
export const LARGURA_UTIL_PT = A4_PT.largura - 2 * PAGINA_DOCUMENTO.margemPt;

/**
 * Respiro horizontal máximo (pt) de uma célula de tabela no layout `lightHorizontalLines` do
 * pdfmake (8 pt de cada lado): o que sobra para o texto é a coluna menos isto.
 */
export const RESPIRO_CELULA_PT = 16;

/** Tamanhos de texto (pt) do PDF e do DOCX. */
export const TIPOGRAFIA_DOCUMENTO = {
  corpoPt: 10.5,
  /** Texto das tabelas: menor, para "30/10/2026" caber inteiro na coluna de prazo (15%). */
  tabelaPt: 9.5,
  tituloPt: 16,
  secaoPt: 12.5,
  subtituloPt: 11,
  cabecalhoPt: 9.5,
  avisoPt: 8.5,
  rodapePt: 8,
} as const;

/** Caixa (pt) em que a logo cabe no documento; a logo nunca é ampliada. */
export const LOGO_CAIXA_PT = { largura: 180, altura: 48 } as const;

/**
 * Densidades da conversão pixel ↔ ponto. A logo (PNG medido em pixels) sai no PDF e no DOCX no
 * tamanho natural a 96 px/pol., reduzida para caber em `LOGO_CAIXA_PT`, nunca ampliada. Converter
 * multiplicando e depois dividindo mantém as contas exatas (1 px = 0,75 pt).
 */
export const PX_POR_POLEGADA = 96;
export const PT_POR_POLEGADA = 72;

/**
 * Espaçamentos e traços (pt) do PDF e do DOCX. Fonte única: nada de número solto em
 * `export/pdf/definicao.ts` nem em `export/docx/gerar-docx.ts`.
 */
export const ESPACOS_DOCUMENTO = {
  /** Entre a logo e as linhas do cabeçalho. */
  entreLogoECabecalhoPt: 16,
  /** Depois do timbre (logo + linhas), antes do título. */
  aposTimbrePt: 16,
  /** Depois do título da ata. */
  aposTituloPt: 16,
  /** Antes de um subtítulo ou título de seção. */
  antesDeSecaoPt: 14,
  /** Depois de um subtítulo ou título de seção. */
  aposSecaoPt: 6,
  /** Depois de parágrafo, lista ou tabela. */
  aposBlocoPt: 8,
  /** Entre itens de lista. */
  entreItensPt: 2,
  /** Altura reservada acima da linha de assinatura. */
  espacoParaAssinarPt: 36,
  /** Entre as duas assinaturas da mesma linha. */
  entreAssinaturasPt: 32,
  /** Margem interna da caixa do aviso de minuta. */
  respiroDoAvisoPt: 6,
  /** Distância do rodapé paginado à borda inferior da área de conteúdo. */
  rodapeTopoPt: 24,
  /** Espessura da linha de assinatura. */
  linhaAssinaturaPt: 0.75,
  /** Espessura da borda fina (caixa do aviso). */
  bordaFinaPt: 0.5,
} as const;

/**
 * Cor do texto no PDF e no DOCX: a tinta da folha (`--cor-folha-tinta` em tokens.css). O arquivo
 * reproduz a folha; `config/documento.test.ts` confere a igualdade.
 */
export const COR_TEXTO_DOCUMENTO = '#1a1a1a';

/**
 * Fundo das lacunas `[PREENCHER: …]` no PDF e no DOCX: o mesmo da folha
 * (`--cor-folha-lacuna-fundo` em tokens.css), conferido por `config/documento.test.ts`.
 */
export const COR_FUNDO_PREENCHER = '#fbebd9';

/** Famílias do DOCX: o Word as resolve no computador de quem abre (nada é embutido). */
export const FONTES_DOCX = { titulo: 'Cambria', corpo: 'Calibri' } as const;

/**
 * Linhas das tabelas de dados, como o `lightHorizontalLines` do pdfmake as desenha: só linhas
 * horizontais, finas e cinza entre as linhas, com a de baixo do cabeçalho mais grossa e na cor do
 * texto. O DOCX reproduz o mesmo desenho.
 */
export const LINHAS_TABELA = { corPadrao: '#aaaaaa', padraoPt: 1, cabecalhoPt: 2 } as const;

/** Medidas (pt) que só o DOCX usa: respiro das células e recuo da lista. */
export const ESPACOS_DOCX = {
  celulaVerticalPt: 2,
  celulaHorizontalPt: 4,
  /** Recuo do texto dos itens de lista e quanto o marcador avança para a esquerda dele. */
  recuoListaPt: 18,
  marcadorListaPt: 12,
} as const;
