import { colunasDeParticipantes } from '../ata-types/registry';
import { prazoOuNulo, rotuloDaOpcao, textoLimpo } from '../ata-types/texto-modelo';
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
import { partesDoRodape } from './rodape';

/** Lacuna que a pessoa completa à mão: `[PREENCHER: o que falta]`. Sempre em maiúsculas. */
const LACUNA = /\[PREENCHER(?::[^\]]*)?\]/g;

/** Chave da seção que ocupa o lugar das seções geradas antes da geração. */
const CHAVE_SECOES_PENDENTES = 'pendente';

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

/** Texto corrido de um parágrafo ou item de lista: as partes coladas, sem o destaque. */
export const textoDoInline = (partes: Inline[]): string => partes.map((p) => p.texto).join('');

function textosDoBloco(bloco: DocBloco): string[] {
  switch (bloco.tipo) {
    case 'titulo':
    case 'subtitulo':
    case 'aviso':
      return [bloco.texto];
    case 'paragrafo':
      return [textoDoInline(bloco.partes)];
    case 'lista':
      return bloco.itens.map(textoDoInline);
    case 'secao':
      return [bloco.titulo, ...bloco.blocos.flatMap(textosDoBloco)];
    case 'tabela':
      return [...bloco.colunas, ...bloco.linhas.flat()];
    case 'assinaturas':
      return bloco.pessoas.flatMap((p) => [p.nome, p.papel]);
  }
}

/**
 * Todo texto que os arquivos (PDF e DOCX) imprimem, na ordem do documento: título, linhas do
 * cabeçalho, blocos (títulos de seção, parágrafos e itens de lista com as lacunas no lugar,
 * cabeçalho e células das tabelas, assinaturas, aviso de minuta) e o texto fixo do rodapé
 * paginado. **Nunca** `rodapeInterno`, que só aparece na tela.
 */
export function textosDoDocumento(modelo: DocumentModel): string[] {
  const rodape = partesDoRodape(modelo.rodape).flatMap((p) =>
    p.tipo === 'texto' ? [p.texto] : [],
  );
  return [
    modelo.titulo,
    ...modelo.cabecalho.linhas,
    ...modelo.blocos.flatMap(textosDoBloco),
    rodape.join(''),
  ];
}

/** Quantas lacunas `[PREENCHER: …]` o documento ainda tem (todo texto impresso). */
export function contarPreencher(modelo: DocumentModel): number {
  return textosDoDocumento(modelo).reduce((soma, texto) => soma + contarEmTexto(texto), 0);
}

function paragrafo(texto: string): DocBloco {
  return { tipo: 'paragrafo', partes: dividirPreencher(texto) };
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
  return (campo.tipo === 'escolha' ? rotuloDaOpcao(campo, valor) : null) ?? valor;
}

function tabelaDeParticipantes(d: EntradaDoDocumento, tipo: AtaTypeDefinition): DocBloco {
  const colunas = colunasDeParticipantes(tipo, d.dados);
  const celula = (p: Participante, id: string, campo: CampoDef | null): string => {
    if (id === 'nome') return textoLimpo(p.nome) || CELULA_VAZIA;
    if (id === 'papel') return textoLimpo(p.papel) || CELULA_VAZIA;
    if (id === 'presenca') return celulaPresenca(p);
    return campo ? celulaExtra(campo, p) : CELULA_VAZIA;
  };
  return {
    tipo: 'tabela',
    colunas: colunas.map((c) => c.rotulo),
    linhas: d.participantes.map((p) => colunas.map((c) => celula(p, c.id, c.campo))),
    colunaPresenca: colunas.findIndex((c) => c.id === 'presenca'),
    presencas: d.participantes.map((p) => p.presenca),
  };
}

/** Célula do prazo (regra em `prazoOuNulo`); sem prazo, o traço de célula vazia. */
function celulaPrazo(prazo: string): string {
  return prazoOuNulo(prazo) ?? CELULA_VAZIA;
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
    blocos.push(
      { tipo: 'subtitulo', texto: tipo.rotulos.participantes },
      tabelaDeParticipantes(d, tipo),
    );
  }

  const pauta = d.pauta.map(textoLimpo).filter((item) => item !== '');
  if (pauta.length > 0) {
    blocos.push(
      { tipo: 'subtitulo', texto: tipo.rotulos.pauta },
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
    // Todos os grupos num único bloco, como antes; a apresentação por grupo vem no Task 2.
    const pessoas = tipo.assinaturas(d).flatMap((g) => g.pessoas);
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
