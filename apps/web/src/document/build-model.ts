import { dataOuNulo, textoLimpo } from '../ata-types/texto-modelo';
import type { AtaTypeDefinition, CampoDef } from '../ata-types/types';
import {
  AVISO_MINUTA,
  CELULA_VAZIA,
  LARGURAS_ENCAMINHAMENTOS,
  RESPONSAVEL_A_DEFINIR,
  RODAPE_INTERNO_IA,
  RODAPE_PAGINADO,
  TEXTO_SECOES_PENDENTES,
  TITULO_ENCAMINHAMENTOS,
} from '../config/documento';
import {
  ROTULO_PRESENCA,
  ROTULO_STATUS,
  type EntradaDoDocumento,
  type Bloco,
  type Encaminhamento,
  type Participante,
  type ResultadoAta,
} from '../domain/draft';
import { CHAVE_ENCAMINHAMENTOS } from '../domain/draft-reducer';
import { ROTULO_CURTO } from '../config/models';
import type { DocBloco, DocumentModel, Inline, LogoDoc } from './model';

/** Lacuna que a pessoa completa à mão: `[PREENCHER: o que falta]`. Sempre em maiúsculas. */
const LACUNA = /\[PREENCHER(?::[^\]]*)?\]/g;

/** Chave da seção que ocupa o lugar das seções geradas antes da geração. */
const CHAVE_SECOES_PENDENTES = 'pendente';

const TITULO_PARTICIPANTES = 'Participantes';
const TITULO_PAUTA = 'Pauta';
const TITULO_SECOES_PENDENTES = 'Seções da ata';
const COLUNAS_ENCAMINHAMENTOS = ['Ação', 'Responsável', 'Prazo', 'Status'];

/** Divide o texto em trechos comuns e lacunas `[PREENCHER: …]` (estas com `destaque`). */
export function dividirPreencher(texto: string): Inline[] {
  const partes: Inline[] = [];
  let desde = 0;
  for (const achado of texto.matchAll(LACUNA)) {
    if (achado.index > desde) partes.push({ texto: texto.slice(desde, achado.index) });
    partes.push({ texto: achado[0], destaque: 'preencher' });
    desde = achado.index + achado[0].length;
  }
  if (desde < texto.length) partes.push({ texto: texto.slice(desde) });
  return partes;
}

function contarEmTexto(texto: string): number {
  return Array.from(texto.matchAll(LACUNA)).length;
}

function contarEmInline(partes: Inline[]): number {
  return partes.filter((p) => p.destaque === 'preencher').length;
}

function contarEmBloco(bloco: DocBloco): number {
  switch (bloco.tipo) {
    case 'titulo':
    case 'subtitulo':
    case 'aviso':
      return contarEmTexto(bloco.texto);
    case 'paragrafo':
      return contarEmInline(bloco.partes);
    case 'lista':
      return bloco.itens.reduce((soma, item) => soma + contarEmInline(item), 0);
    case 'secao':
      return bloco.blocos.reduce((soma, b) => soma + contarEmBloco(b), 0);
    case 'tabela':
      return bloco.linhas.reduce(
        (soma, linha) => soma + linha.reduce((s, celula) => s + contarEmTexto(celula), 0),
        0,
      );
    case 'assinaturas':
      return bloco.pessoas.reduce(
        (soma, p) => soma + contarEmTexto(p.nome) + contarEmTexto(p.papel),
        0,
      );
  }
}

/** Quantas lacunas `[PREENCHER: …]` o documento ainda tem (texto, listas e células de tabela). */
export function contarPreencher(modelo: DocumentModel): number {
  return (
    contarEmTexto(modelo.titulo) +
    modelo.cabecalho.linhas.reduce((soma, l) => soma + contarEmTexto(l), 0) +
    modelo.blocos.reduce((soma, b) => soma + contarEmBloco(b), 0)
  );
}

function paragrafo(texto: string): DocBloco {
  return { tipo: 'paragrafo', partes: dividirPreencher(texto) };
}

function opcaoDo(campo: CampoDef, valor: string): string | null {
  return campo.opcoes?.find((o) => o.valor === valor)?.rotulo ?? null;
}

/** Texto de presença; a justificativa só vale (e só é impressa) para quem está justificado. */
function celulaPresenca(p: Participante): string {
  const rotulo = ROTULO_PRESENCA[p.presenca];
  const justificativa = textoLimpo(p.justificativa);
  return p.presenca === 'justificado' && justificativa !== ''
    ? `${rotulo}: ${justificativa}`
    : rotulo;
}

function celulaExtra(campo: CampoDef, p: Participante): string {
  const valor = textoLimpo(p.extras[campo.id]);
  if (valor === '') return CELULA_VAZIA;
  return (campo.tipo === 'escolha' ? opcaoDo(campo, valor) : null) ?? valor;
}

function tabelaDeParticipantes(d: EntradaDoDocumento, tipo: AtaTypeDefinition): DocBloco {
  const extras = tipo.camposParticipante;
  return {
    tipo: 'tabela',
    colunas: ['Nome', tipo.rotuloPapel, ...extras.map((c) => c.rotulo), 'Presença'],
    linhas: d.participantes.map((p) => [
      textoLimpo(p.nome) || CELULA_VAZIA,
      textoLimpo(p.papel) || CELULA_VAZIA,
      ...extras.map((c) => celulaExtra(c, p)),
      celulaPresenca(p),
    ]),
    colunaPresenca: 2 + extras.length,
    presencas: d.participantes.map((p) => p.presenca),
  };
}

/** Texto do prazo: data `AAAA-MM-DD` válida vira `dd/mm/aaaa`; qualquer outro texto é mantido. */
function celulaPrazo(prazo: string): string {
  return dataOuNulo(prazo) ?? (textoLimpo(prazo) || CELULA_VAZIA);
}

function tabelaDeEncaminhamentos(itens: Encaminhamento[]): DocBloco {
  return {
    tipo: 'tabela',
    colunas: COLUNAS_ENCAMINHAMENTOS,
    linhas: itens.map((e) => [
      e.acao,
      textoLimpo(e.responsavel) || RESPONSAVEL_A_DEFINIR,
      celulaPrazo(e.prazo),
      ROTULO_STATUS[e.status],
    ]),
    larguras: [...LARGURAS_ENCAMINHAMENTOS],
  };
}

/** Blocos da IA → blocos do documento; bloco sem texto some. */
function blocosDaSecao(blocos: Bloco[]): DocBloco[] {
  return blocos.flatMap((b): DocBloco[] => {
    const texto = textoLimpo(b.texto);
    const resultado: DocBloco[] = texto === '' ? [] : [paragrafo(texto)];
    if (b.tipo === 'lista') {
      const itens = b.itens.map(textoLimpo).filter((i) => i !== '');
      if (itens.length > 0) resultado.push({ tipo: 'lista', itens: itens.map(dividirPreencher) });
    }
    return resultado;
  });
}

function secaoGerada(chave: string, titulo: string, blocos: DocBloco[]): DocBloco[] {
  return blocos.length === 0 ? [] : [{ tipo: 'secao', chave, titulo, blocos, gerada: true }];
}

/** "Minuta gerada com auxílio de IA (Gemini · modelo, …)." com a autoria das seções na folha. */
function rodapeInterno(blocos: DocBloco[], resultado: ResultadoAta | null): string | null {
  if (!resultado) return null;
  const usados = new Set<string>();
  for (const b of blocos) {
    if (b.tipo !== 'secao' || !b.gerada) continue;
    const a = resultado.atribuicao[b.chave];
    if (a) usados.add(`${ROTULO_CURTO[a.provedor]} · ${a.modelo}`);
  }
  return usados.size === 0 ? null : `${RODAPE_INTERNO_IA} (${[...usados].join(', ')}).`;
}

/**
 * Monta o documento da ata. Antes de gerar (sem `resultado`) traz só o que o formulário já tem,
 * mais um placeholder no lugar das seções. Depois, preâmbulo, seções na ordem do tipo (as vazias
 * não aparecem), encaminhamentos, fecho, assinaturas e o aviso de minuta. A `logo` (já rasterizada)
 * vai só para o cabeçalho: nunca faz parte do rascunho nem do que a IA recebe.
 */
export function construirDocumento(
  d: EntradaDoDocumento,
  tipo: AtaTypeDefinition,
  logo: LogoDoc | null = null,
): DocumentModel {
  const resultado = d.resultado;
  const blocos: DocBloco[] = [];

  if (resultado) blocos.push(paragrafo(tipo.preambulo(d)));

  if (d.participantes.length > 0) {
    blocos.push({ tipo: 'subtitulo', texto: TITULO_PARTICIPANTES }, tabelaDeParticipantes(d, tipo));
  }

  const pauta = d.pauta.map(textoLimpo).filter((item) => item !== '');
  if (pauta.length > 0) {
    blocos.push(
      { tipo: 'subtitulo', texto: TITULO_PAUTA },
      { tipo: 'lista', itens: pauta.map(dividirPreencher) },
    );
  }

  if (!resultado) {
    blocos.push({
      tipo: 'secao',
      chave: CHAVE_SECOES_PENDENTES,
      titulo: TITULO_SECOES_PENDENTES,
      blocos: [paragrafo(TEXTO_SECOES_PENDENTES)],
      gerada: false,
    });
  } else {
    for (const secao of tipo.secoes) {
      blocos.push(
        ...secaoGerada(
          secao.chave,
          secao.titulo,
          blocosDaSecao(resultado.secoes[secao.chave] ?? []),
        ),
      );
    }
    if (tipo.temEncaminhamentos && resultado.encaminhamentos.length > 0) {
      blocos.push(
        ...secaoGerada(CHAVE_ENCAMINHAMENTOS, TITULO_ENCAMINHAMENTOS, [
          tabelaDeEncaminhamentos(resultado.encaminhamentos),
        ]),
      );
    }
    blocos.push(paragrafo(tipo.fecho(d)));
    const pessoas = tipo.assinaturas(d);
    if (pessoas.length > 0) blocos.push({ tipo: 'assinaturas', pessoas });
    blocos.push({ tipo: 'aviso', texto: AVISO_MINUTA });
  }

  return {
    titulo: tipo.titulo(d.dados),
    cabecalho: { logo, linhas: tipo.cabecalho(d) },
    blocos,
    rodape: RODAPE_PAGINADO,
    rodapeInterno: rodapeInterno(blocos, resultado),
  };
}
