import type { DocumentModel } from '../document/model';
import type { FormatoExportacao } from './nome-arquivo';

/**
 * Como os geradores chegam à barra. Os módulos de PDF e DOCX (pdfmake, fontes e `docx`, ~1,3 MB)
 * só entram por `import()` dinâmico: ficam fora da carga inicial e são baixados na primeira
 * exportação. Os testes trocam os carregadores por geradores falsos.
 */
export interface CarregadoresExportacao {
  pdf: () => Promise<{ gerarPdf: (modelo: DocumentModel) => Promise<Blob> }>;
  docx: () => Promise<{ gerarDocx: (modelo: DocumentModel) => Promise<Blob> }>;
}

export const CARREGADORES_PADRAO: CarregadoresExportacao = {
  pdf: () => import('./pdf/gerar-pdf'),
  docx: () => import('./docx/gerar-docx'),
};

const ROTULO_FORMATO: Record<FormatoExportacao, string> = { pdf: 'PDF', docx: 'DOCX' };
const OUTRO_FORMATO: Record<FormatoExportacao, FormatoExportacao> = { pdf: 'docx', docx: 'pdf' };

function mensagemDoErro(motivo: ErroExportacao['motivo'], formato: FormatoExportacao): string {
  const nome = ROTULO_FORMATO[formato];
  if (motivo === 'carregamento') {
    return `Não foi possível carregar o gerador de ${nome}. Verifique a conexão e recarregue a página — o rascunho desta aba fica salvo.`;
  }
  return `Não foi possível gerar o ${nome}. Tente de novo; se persistir, baixe o ${ROTULO_FORMATO[OUTRO_FORMATO[formato]]}.`;
}

/**
 * Falha ao exportar. A `message` é fixa, em pt-BR, com causa e ação: o texto original da
 * biblioteca (pdfmake, docx, canvas) pode conter dados da ata e por isso nunca é carregado, exibido
 * nem registrado.
 */
export class ErroExportacao extends Error {
  readonly motivo: 'carregamento' | 'geracao';
  readonly formato: FormatoExportacao;

  constructor(motivo: 'carregamento' | 'geracao', formato: FormatoExportacao) {
    super(mensagemDoErro(motivo, formato));
    this.name = 'ErroExportacao';
    this.motivo = motivo;
    this.formato = formato;
  }
}

/** Gera o arquivo do formato pedido. Qualquer rejeição vira `ErroExportacao` (sem o texto original). */
export async function gerarArquivo(
  formato: FormatoExportacao,
  modelo: DocumentModel,
  carregadores: CarregadoresExportacao = CARREGADORES_PADRAO,
): Promise<Blob> {
  let gerar: (m: DocumentModel) => Promise<Blob>;
  try {
    if (formato === 'pdf') {
      const { gerarPdf } = await carregadores.pdf();
      gerar = gerarPdf;
    } else {
      const { gerarDocx } = await carregadores.docx();
      gerar = gerarDocx;
    }
  } catch {
    throw new ErroExportacao('carregamento', formato);
  }
  try {
    return await gerar(modelo);
  } catch {
    throw new ErroExportacao('geracao', formato);
  }
}
