import type { AtaTypeDefinition } from '../../ata-types/types';
import { TITULO_ENCAMINHAMENTOS } from '../../config/documento';
import type { DocBloco } from '../../document/model';
import { CHAVE_ENCAMINHAMENTOS } from '../../domain/draft-reducer';

/**
 * Só para a tela: o `DocumentModel` omite as seções sem conteúdo (PDF e DOCX dependem disso), mas
 * quem revisa precisa achar a seção vazia para escrevê-la ou gerá-la. Devolve os blocos do modelo
 * com um marcador (`secao` sem blocos) de cada seção do tipo que ficou de fora, na posição do
 * documento: antes da próxima seção presente ou, se não há, antes do fecho.
 *
 * Chamar só depois de gerar (com `resultado`): antes disso o modelo tem o placeholder único.
 */
export function comSecoesVazias(blocos: DocBloco[], tipo: AtaTypeDefinition): DocBloco[] {
  const esperadas = [
    ...tipo.secoes.map(({ chave, titulo }) => ({ chave, titulo })),
    ...(tipo.temEncaminhamentos
      ? [{ chave: CHAVE_ENCAMINHAMENTOS, titulo: TITULO_ENCAMINHAMENTOS }]
      : []),
  ];
  const indicePresente = new Map<string, number>();
  blocos.forEach((b, i) => {
    if (b.tipo === 'secao') indicePresente.set(b.chave, i);
  });
  if (esperadas.every((e) => indicePresente.has(e.chave))) return blocos;

  // O fecho é o último parágrafo solto (assinaturas e aviso de minuta vêm depois).
  const indiceFecho = blocos.findLastIndex((b) => b.tipo === 'paragrafo');
  const antes = new Map<number, DocBloco[]>();
  esperadas.forEach((e, posicao) => {
    if (indicePresente.has(e.chave)) return;
    const seguinte = esperadas
      .slice(posicao + 1)
      .map((s) => indicePresente.get(s.chave))
      .find((i) => i !== undefined);
    const ancora = seguinte ?? indiceFecho;
    antes.set(ancora, [
      ...(antes.get(ancora) ?? []),
      { tipo: 'secao', chave: e.chave, titulo: e.titulo, blocos: [], gerada: true },
    ]);
  });
  return blocos.flatMap((b, i) => [...(antes.get(i) ?? []), b]);
}
