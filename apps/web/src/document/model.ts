import type { Presenca } from '../domain/draft';

/**
 * Modelo de documento: dado puro (sem React, sem HTML) que a folha A4 em tela e, no Plano 04, os
 * renderizadores de PDF e DOCX consomem. Toda decisão de conteúdo (ordem, textos, formatação de
 * datas, rótulos) já está resolvida aqui; quem renderiza decide só a tipografia.
 */

export interface Inline {
  texto: string;
  /** Lacuna `[PREENCHER: …]` que a pessoa deve completar à mão. */
  destaque?: 'preencher';
}

export type DocBloco =
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'paragrafo'; partes: Inline[] }
  | { tipo: 'lista'; itens: Inline[][] }
  | {
      tipo: 'secao';
      chave: string;
      titulo: string;
      blocos: DocBloco[];
      /** `true` quando o conteúdo veio da IA (a seção aceita regerar/editar). */
      gerada: boolean;
    }
  | {
      tipo: 'tabela';
      colunas: string[];
      linhas: string[][];
      /** Largura de cada coluna, em %. */
      larguras?: number[];
      /** Índice da coluna de presença; o renderizador pode acompanhar o texto de um ícone. */
      colunaPresenca?: number;
      /** Presença de cada linha (mesma ordem de `linhas`), para o ícone sem ler o texto da célula. */
      presencas?: Presenca[];
    }
  | { tipo: 'assinaturas'; pessoas: { nome: string; papel: string }[] }
  | { tipo: 'aviso'; texto: string };

export interface DocumentModel {
  titulo: string;
  /** `logo` é a imagem da pessoa (Plano 04); `null` = espaço reservado. */
  cabecalho: { logo: string | null; linhas: string[] };
  blocos: DocBloco[];
  /** Rodapé paginado dos documentos (PDF e DOCX); a folha em tela é contínua e não o exibe. */
  rodape: string;
  /**
   * Rodapé interno da folha em tela: os provedores e modelos que geraram as seções presentes
   * (spec 8.1.1). Não vai para PDF nem DOCX. `null` quando nenhuma seção tem autoria de IA.
   */
  rodapeInterno: string | null;
}
