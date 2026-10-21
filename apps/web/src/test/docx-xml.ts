import { unzipSync } from 'fflate';

/** Partes do .docx (zip): caminho dentro do arquivo → XML em texto. Só para testes. */
export async function xmlDoDocx(arquivo: Blob): Promise<Map<string, string>> {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const decodificador = new TextDecoder();
  const partes = new Map<string, string>();
  for (const [caminho, conteudo] of Object.entries(unzipSync(bytes))) {
    // Entradas de pasta ("word/media/") não são arquivos.
    if (caminho.endsWith('/')) continue;
    // Mídia (PNG) não é texto: só o caminho importa, e o conteúdo fica vazio.
    partes.set(caminho, caminho.startsWith('word/media/') ? '' : decodificador.decode(conteudo));
  }
  return partes;
}
