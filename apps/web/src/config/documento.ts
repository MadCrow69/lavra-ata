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

/** Responsável do encaminhamento quando a transcrição não deixa claro quem fará. */
export const RESPONSAVEL_A_DEFINIR = 'A definir';

/** Página A4 do PDF e do DOCX (pt). Fonte única para os dois formatos. */
export const PAGINA_DOCUMENTO = { margemPt: 56, margemInferiorPt: 64 } as const;

/** Tamanhos de texto (pt) do PDF e do DOCX. */
export const TIPOGRAFIA_DOCUMENTO = {
  corpoPt: 10.5,
  tituloPt: 16,
  secaoPt: 12.5,
  subtituloPt: 11,
  cabecalhoPt: 9.5,
  avisoPt: 8.5,
  rodapePt: 8,
} as const;

/** Caixa (pt) em que a logo cabe no documento; a logo nunca é ampliada. */
export const LOGO_CAIXA_PT = { largura: 180, altura: 48 } as const;

/** Cor do texto no PDF e no DOCX: grafite (folha sóbria). */
export const COR_TEXTO_DOCUMENTO = '#1f2a37';

/** Fundo das lacunas `[PREENCHER: …]` no PDF e no DOCX. */
export const COR_FUNDO_PREENCHER = '#f3dcc9';

/** Famílias do DOCX: o Word as resolve no computador de quem abre (nada é embutido). */
export const FONTES_DOCX = { titulo: 'Cambria', corpo: 'Calibri' } as const;
