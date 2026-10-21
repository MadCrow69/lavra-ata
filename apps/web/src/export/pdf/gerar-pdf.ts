import pdfMake from 'pdfmake/build/pdfmake';
import type { DocumentModel } from '../../document/model';
import { FONTES_PDFMAKE, VFS_FONTES } from './arquivos-fonte';
import { definicaoPdf } from './definicao';

/*
 * Renderizador PDF. Entra SÓ por `import()` dinâmico no clique (Task 8): pdfmake e as fontes
 * ficam num chunk próprio, fora do bundle inicial. Nada de rede: fontes por VFS (base64 dos
 * `?inline`), logo por data URL e toda URL externa recusada pela política de acesso.
 */

let configurado = false;

function configurar(): void {
  if (configurado) return;
  pdfMake.setUrlAccessPolicy(() => false);
  pdfMake.addVirtualFileSystem(VFS_FONTES);
  // `setFonts` substitui o dicionário inteiro: o Roboto padrão (que não está no VFS) sai.
  pdfMake.setFonts(FONTES_PDFMAKE);
  configurado = true;
}

/** Gera o PDF da ata no navegador. */
export async function gerarPdf(modelo: DocumentModel): Promise<Blob> {
  configurar();
  return pdfMake.createPdf(definicaoPdf(modelo)).getBlob();
}
