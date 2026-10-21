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
