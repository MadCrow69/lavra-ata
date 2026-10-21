import { ESPERA_REVOGAR_URL_MS } from '../config/ui';

/**
 * Entrega o arquivo ao navegador por um link `<a download>` com URL de objeto (nada sai da
 * máquina). A URL só é revogada depois de `ESPERA_REVOGAR_URL_MS`: revogar logo cancelaria o
 * download em alguns navegadores.
 */
export function baixarArquivo(conteudo: Blob, nome: string): void {
  const url = URL.createObjectURL(conteudo);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.hidden = true;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, ESPERA_REVOGAR_URL_MS);
  }
}
