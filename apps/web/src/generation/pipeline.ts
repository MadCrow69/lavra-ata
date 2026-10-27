import {
  createMaskMap,
  findMarkers,
  mask,
  unmask,
  validateOutput,
  type MaskMap,
} from '@lavra/pii-br';
import { ehVisivel } from '../ata-types/registry';
import type { AtaTypeDefinition } from '../ata-types/types';
import { gerarComFallback, type OpcoesCadeia } from '../ai/chain';
import { erroProvedor } from '../ai/errors';
import { ehRegistro } from '../ai/providers/comum';
import type { FalhaProvedor, ProviderConfig, ResultadoCadeia } from '../ai/types';
import type {
  AtaDraft,
  Atribuicao,
  Bloco,
  Encaminhamento,
  Participante,
  ResultadoAta,
} from '../domain/draft';
import { CHAVE_AVISOS_GERAIS, CHAVE_ENCAMINHAMENTOS } from '../domain/draft-reducer';
import { nomeComArtigo } from '../features/privacy/rotulos';
import { normalizarBlocos, normalizarEncaminhamentos, normalizarResultado } from './normalize';
import { exigirChaveDeSecao, nomeDoSchema, schemaDaAta, schemaDaSecao } from './output-schema';
import { montarPrompt, montarPromptSecao, textoAtualDaSecao, type Prompt } from './prompt';

/**
 * Pipeline de geração (spec 5.2 e 8.3):
 * mascara (mesmo mapa do rascunho) → prompt → cadeia de provedores → normaliza → `validateOutput`
 * por seção (o aviso fica na seção onde o problema apareceu) → `unmask` campo a campo.
 *
 * Funções puras em relação ao rascunho: nunca alteram `d`; quem chama grava o resultado só no
 * sucesso. Cancelar lança `ErroProvedor` com `tipo: 'cancelado'`; todos os provedores falhando
 * lançam `ErroCadeia` (de `gerarComFallback`). Nenhuma mensagem leva chave ou dado desmascarado.
 */

export interface Colisao {
  /** Literal com forma de marcador que a pessoa escreveu (ex.: `[CPF_1]`). */
  literal: string;
  /** Como ele foi enviado (ex.: `[CPF#1]`). */
  reescrito: string;
}

/**
 * Mascara vários textos em sequência com o MESMO mapa, acumulando as colisões. Recebe sempre
 * texto ORIGINAL (nunca texto que já passou por aqui): é isso que impede remascarar marcadores.
 */
class Mascarador {
  mapa: MaskMap;
  readonly colisoes: Colisao[] = [];

  constructor(inicial: MaskMap | null) {
    this.mapa = inicial ?? createMaskMap();
  }

  mascarar = (texto: string): string => {
    const antes = this.mapa;
    const r = mask(texto, { map: antes });
    for (const literal of r.collisions) {
      if (this.colisoes.some((c) => c.literal === literal)) continue;
      // O próprio `mask` diz como o literal foi reescrito com o mapa de antes.
      this.colisoes.push({ literal, reescrito: mask(literal, { map: antes }).masked });
    }
    this.mapa = r.map;
    return r.masked;
  };
}

/**
 * Cópia do rascunho com tudo que vai para a IA mascarado: transcrição primeiro (é ela que define
 * a numeração), depois metadados, pauta e participantes. A cópia leva SÓ os campos de
 * `camposNoPrompt` e os extras de participante com `enviarParaIA` (todos mascarados); demais
 * campos, justificativas, extras, resultado e mapa não seguem.
 */
function rascunhoMascarado(d: AtaDraft, tipo: AtaTypeDefinition, m: Mascarador): AtaDraft {
  const transcricao = m.mascarar(d.transcricao);
  const dados: Record<string, string> = {};
  for (const id of tipo.camposNoPrompt) {
    const valor = d.dados[id];
    if (valor !== undefined) dados[id] = m.mascarar(valor);
  }
  // Dos extras de participante só seguem os marcados com `enviarParaIA`, mascarados; unidade,
  // fração, participação etc. ficam no navegador e nem entram no mapa de marcadores. A visibilidade
  // é decidida sobre a cópia mascarada (a mesma que a IA vê): uma decisão só, sem ler o original.
  const idsDosExtras = tipo.camposParticipante
    .filter((c) => c.enviarParaIA === true && ehVisivel(c, dados))
    .map((c) => c.id);
  const extrasParaIA = (p: Participante): Record<string, string> =>
    Object.fromEntries(
      idsDosExtras.flatMap((id) => {
        const valor = p.extras[id];
        return valor === undefined ? [] : [[id, m.mascarar(valor)]];
      }),
    );
  return {
    ...d,
    transcricao,
    dados,
    pauta: d.pauta.map(m.mascarar),
    participantes: d.participantes.map((p) => ({
      ...p,
      nome: m.mascarar(p.nome),
      // Tipo sem coluna de papel: o que estiver ali não é enviado, então nem entra no mapa.
      papel: tipo.rotuloPapel === null ? '' : m.mascarar(p.papel),
      justificativa: '',
      extras: extrasParaIA(p),
    })),
    mapa: null,
    resultado: null,
  };
}

function avisoDeColisao(c: Colisao): string {
  return `Seu texto já tinha um trecho parecido com um marcador (${c.literal}); ele foi mantido como ${c.reescrito}.`;
}

/** Marcadores (forma canônica) de um texto que não existem no mapa. */
function marcadoresForaDoMapa(texto: string, mapa: MaskMap | null): Set<string> {
  return new Set(
    findMarkers(texto)
      .map((m) => `[${m.type}_${m.number}]`)
      .filter((c) => !mapa || !Object.hasOwn(mapa.markers, c)),
  );
}

/**
 * Problemas de `validateOutput` num trecho da saída, em pt-BR, sem repetir e sem dado pessoal.
 * `suspeitos`: marcadores que já estavam no texto atual da seção sem existir no mapa (a IA os
 * inventou antes). Ao regerar, o `mask` os trata como literais reservados e o `validateOutput`
 * deixa de apontá-los; se a nova saída ainda os traz, o aviso continua.
 */
function avisosDaSaida(
  saida: string,
  mapa: MaskMap,
  enviado: string,
  suspeitos: ReadonlySet<string> = new Set(),
): string[] {
  if (saida === '') return [];
  const r = validateOutput(saida, mapa, enviado);
  const repetidos = [...marcadoresForaDoMapa(saida, mapa)].filter((c) => suspeitos.has(c));
  const avisos = [
    ...[...r.unknownMarkers, ...repetidos].map(
      (m) =>
        `A IA escreveu o marcador ${m}, que não corresponde a nenhum dado da transcrição — confira o trecho.`,
    ),
    ...r.malformedMarkers.map(
      (m) =>
        `A IA alterou o marcador “${m}”, e o dado original pode não ter sido restaurado — confira o trecho.`,
    ),
    ...r.newIdentifiers.map(
      (f) => `A IA citou ${nomeComArtigo(f.type)} que não estava na transcrição — confira.`,
    ),
  ];
  return [...new Set(avisos)];
}

const textoDosBlocos = (blocos: Bloco[]): string =>
  blocos.flatMap((b) => [b.texto, ...b.itens]).join('\n');

const textoDosEncaminhamentos = (itens: Encaminhamento[]): string =>
  itens.flatMap((e) => [e.acao, e.responsavel, e.prazo]).join('\n');

function desmascararBlocos(blocos: Bloco[], mapa: MaskMap): Bloco[] {
  return blocos.map((b) => ({
    ...b,
    texto: unmask(b.texto, mapa),
    itens: b.itens.map((i) => unmask(i, mapa)),
  }));
}

function desmascararEncaminhamentos(itens: Encaminhamento[], mapa: MaskMap): Encaminhamento[] {
  return itens.map((e) => ({
    ...e,
    acao: unmask(e.acao, mapa),
    responsavel: unmask(e.responsavel, mapa),
    prazo: unmask(e.prazo, mapa),
  }));
}

function atribuicaoDe(r: ResultadoCadeia<unknown>): Atribuicao {
  return {
    provedor: r.provedor,
    modelo: r.modelo,
    falhas: r.falhas.map(({ provedor, erro, motivo }) => ({
      provedor,
      erro,
      ...(motivo === undefined ? {} : { motivo }),
    })),
  };
}

/** A resposta chegou, mas a pessoa já cancelou: descarta (o rascunho não muda). */
function conferirCancelamento(signal: AbortSignal, r: ResultadoCadeia<unknown>): void {
  if (signal.aborted) throw erroProvedor('cancelado', r.provedor);
}

/** O pedido da ata inteira, pronto para sair, com o mapa e as colisões da mascaração. */
export interface EnvioDaAta {
  prompt: Prompt;
  /** Mapa de marcadores depois de mascarar tudo que vai no pedido (o `unmask` usa este). */
  mapa: MaskMap;
  colisoes: readonly Colisao[];
}

/**
 * Monta o pedido da ata inteira: mascara o rascunho (mesmo mapa) e monta o prompt. É a ÚNICA
 * montagem: `gerarAta` envia o que sai daqui e `previaDoEnvio` mostra o mesmo, byte a byte. Pura:
 * nunca altera `d`.
 */
export function prepararEnvioDaAta(d: AtaDraft, tipo: AtaTypeDefinition): EnvioDaAta {
  const m = new Mascarador(d.mapa);
  const mascarado = rascunhoMascarado(d, tipo, m);
  const prompt = montarPrompt(tipo, mascarado, mascarado.transcricao);
  return { prompt, mapa: m.mapa, colisoes: m.colisoes };
}

/** O que a revisão antes do envio mostra: exatamente o pedido que `gerarAta` envia. */
export interface PreviaDoEnvio {
  /** Instruções fixas do Lavra (tipo de ata e tom; sem dados da reunião). */
  sistema: string;
  /** Dados da reunião, pauta, participantes e transcrição, já mascarados. */
  usuario: string;
  /** Literais com forma de marcador que a pessoa escreveu e foram reescritos (`[CPF_1]`). */
  colisoes: string[];
}

/** Visão de `prepararEnvioDaAta` para a revisão (o mapa não sai daqui). Pura. */
export function previaDoEnvio(d: AtaDraft, tipo: AtaTypeDefinition): PreviaDoEnvio {
  const { prompt, colisoes } = prepararEnvioDaAta(d, tipo);
  return {
    sistema: prompt.sistema,
    usuario: prompt.usuario,
    colisoes: colisoes.map((c) => c.literal),
  };
}

export async function gerarAta(
  d: AtaDraft,
  tipo: AtaTypeDefinition,
  cadeia: ProviderConfig[],
  signal: AbortSignal,
  opcoes: OpcoesCadeia = {},
): Promise<{
  resultado: ResultadoAta;
  mapa: MaskMap;
  /** Literais com forma de marcador que a pessoa escreveu e colidiram com o mapa. */
  colisoes: string[];
  /** Quem gerou (igual em todas as seções desta geração). */
  atribuicao: Atribuicao;
  /** Provedores que falharam antes do que respondeu (para o aviso de fallback). */
  falhas: FalhaProvedor[];
}> {
  const { prompt, mapa, colisoes } = prepararEnvioDaAta(d, tipo);

  const r = await gerarComFallback(
    cadeia,
    { ...prompt, schema: schemaDaAta(tipo), nomeSchema: nomeDoSchema(tipo), signal },
    opcoes,
  );
  conferirCancelamento(signal, r);

  const normal = normalizarResultado(r.valor, tipo);
  const atribuicao = atribuicaoDe(r);
  const avisos: Record<string, string[]> = {};
  const porSecao: Record<string, Atribuicao> = {};
  const secoes: Record<string, Bloco[]> = {};

  for (const { chave } of tipo.secoes) {
    const blocos = normal.secoes[chave] ?? [];
    avisos[chave] = avisosDaSaida(textoDosBlocos(blocos), mapa, prompt.usuario);
    porSecao[chave] = atribuicao;
    secoes[chave] = desmascararBlocos(blocos, mapa);
  }
  if (tipo.temEncaminhamentos) {
    avisos[CHAVE_ENCAMINHAMENTOS] = avisosDaSaida(
      textoDosEncaminhamentos(normal.encaminhamentos),
      mapa,
      prompt.usuario,
    );
    porSecao[CHAVE_ENCAMINHAMENTOS] = atribuicao;
  }
  if (colisoes.length > 0) avisos[CHAVE_AVISOS_GERAIS] = colisoes.map(avisoDeColisao);

  return {
    resultado: {
      secoes,
      encaminhamentos: desmascararEncaminhamentos(normal.encaminhamentos, mapa),
      atribuicao: porSecao,
      avisos,
      editadas: [],
    },
    mapa,
    colisoes: colisoes.map((c) => c.literal),
    atribuicao,
    falhas: r.falhas,
  };
}

/**
 * Regera uma seção (ou os encaminhamentos), com instrução opcional. Mascara o texto ATUAL da
 * seção — já desmascarado, inclusive edição manual — e a instrução com o mesmo mapa. Para
 * `'encaminhamentos'`, `blocos` traz `Encaminhamento[]`. Colisões viram avisos da própria seção.
 */
export async function regerarSecao(
  d: AtaDraft,
  tipo: AtaTypeDefinition,
  chave: string,
  instrucao: string | null,
  cadeia: ProviderConfig[],
  signal: AbortSignal,
  opcoes: OpcoesCadeia = {},
): Promise<{
  blocos: Bloco[] | Encaminhamento[];
  avisos: string[];
  mapa: MaskMap;
  atribuicao: Atribuicao;
}> {
  exigirChaveDeSecao(tipo, chave);
  const m = new Mascarador(d.mapa);
  const mascarado = rascunhoMascarado(d, tipo, m);
  const textoAtual = textoAtualDaSecao(d, chave);
  const suspeitos = marcadoresForaDoMapa(textoAtual, d.mapa);
  const atual = m.mascarar(textoAtual);
  const pedido = instrucao === null || instrucao.trim() === '' ? null : m.mascarar(instrucao);
  const prompt = montarPromptSecao(tipo, mascarado, chave, atual, pedido, mascarado.transcricao);

  const r = await gerarComFallback(
    cadeia,
    {
      ...prompt,
      schema: schemaDaSecao(tipo, chave),
      nomeSchema: nomeDoSchema(tipo, chave),
      signal,
    },
    opcoes,
  );
  conferirCancelamento(signal, r);

  const { mapa } = m;
  const raiz = ehRegistro(r.valor) ? r.valor : {};
  const colisoes = m.colisoes.map(avisoDeColisao);

  if (chave === CHAVE_ENCAMINHAMENTOS) {
    const itens = normalizarEncaminhamentos(raiz.encaminhamentos);
    return {
      blocos: desmascararEncaminhamentos(itens, mapa),
      avisos: [
        ...colisoes,
        ...avisosDaSaida(textoDosEncaminhamentos(itens), mapa, prompt.usuario, suspeitos),
      ],
      mapa,
      atribuicao: atribuicaoDe(r),
    };
  }
  const blocos = normalizarBlocos(raiz.blocos);
  return {
    blocos: desmascararBlocos(blocos, mapa),
    avisos: [
      ...colisoes,
      ...avisosDaSaida(textoDosBlocos(blocos), mapa, prompt.usuario, suspeitos),
    ],
    mapa,
    atribuicao: atribuicaoDe(r),
  };
}
