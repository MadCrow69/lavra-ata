import { PESOS_COLUNA } from '../config/documento';
import { LIMITE_TRANSCRICAO } from '../config/limits';
import type { AtaDraft, EntradaDoDocumento } from '../domain/draft';
import { cipa } from './cipa';
import { corporativa } from './corporativa';
import { ehVisivel, rotuloDaOpcao, rotuloDoCampo, textoLimpo } from './texto-modelo';
import type { AtaTypeDefinition, CampoDef, CampoFaltando } from './types';

/**
 * Rótulo de opção, rótulo de campo e visibilidade: fontes únicas, definidas em `texto-modelo.ts`
 * (evita ciclo: os tipos as usam e o registro importa os tipos).
 */
export { ehVisivel, rotuloDaOpcao, rotuloDoCampo };

/** Tipo de ata selecionado quando nada foi escolhido ainda. Fonte única do id padrão. */
export const TIPO_PADRAO_ID = corporativa.id;

export const ATA_TYPES: Record<string, AtaTypeDefinition> = {
  [corporativa.id]: corporativa,
  [cipa.id]: cipa,
};

/** Tipo pelo id; id desconhecido (rascunho antigo, sessão corrompida) cai no padrão. */
export function obterTipo(id: string): AtaTypeDefinition {
  return ATA_TYPES[id] ?? corporativa;
}

export function ehObrigatorio(campo: CampoDef, dados: Record<string, string>): boolean {
  return campo.obrigatorioSe ? campo.obrigatorioSe(dados) : campo.obrigatorio;
}

/** Mensagem sob o campo obrigatório vazio. */
export function mensagemObrigatorio(campo: CampoDef, dados: Record<string, string>): string {
  return campo.erroObrigatorio ?? `Preencha o campo “${rotuloDoCampo(campo, dados)}”.`;
}

export type ProblemaCampo = { tipo: 'vazio' } | { tipo: 'invalido'; mensagem: string };

/** Mensagem de um valor de escolha que não está entre as `opcoes` do campo. */
export const MENSAGEM_OPCAO_INVALIDA = 'Escolha uma opção da lista.';

/**
 * O que impede o valor de um campo de valer, ou `null`. Fonte única de "vazio" e "inválido" para
 * campos do formulário e extras de participante. Vazio só conta se o campo é obrigatório e
 * visível; um valor não vazio é conferido contra as `opcoes` e contra `validar` (nunca chamado com
 * vazio). Campo invisível nunca tem problema.
 */
export function problemaDoCampo(
  campo: CampoDef,
  valor: string | undefined,
  dados: Record<string, string>,
): ProblemaCampo | null {
  if (!ehVisivel(campo, dados)) return null;
  const limpo = textoLimpo(valor);
  if (limpo === '') return ehObrigatorio(campo, dados) ? { tipo: 'vazio' } : null;
  if (campo.tipo === 'escolha' && campo.opcoes && rotuloDaOpcao(campo, limpo) === null) {
    return { tipo: 'invalido', mensagem: MENSAGEM_OPCAO_INVALIDA };
  }
  const erro = campo.validar?.(limpo, dados) ?? null;
  return erro === null ? null : { tipo: 'invalido', mensagem: erro };
}

function rotuloDaFalta(
  campo: CampoDef,
  problema: ProblemaCampo,
  dados: Record<string, string>,
): string {
  const rotulo = rotuloDoCampo(campo, dados);
  return problema.tipo === 'vazio' ? rotulo : `${rotulo} (corrigir)`;
}

export interface ColunaParticipante {
  /** `'nome'`, `'papel'`, id do campo extra ou `'presenca'`. */
  id: string;
  rotulo: string;
  peso: number;
  campo: CampoDef | null;
}

/**
 * Colunas da tabela de participantes (formulário e documento): Nome, papel (se o tipo tem),
 * extras visíveis para os `dados` e Presença. Fonte única de ordem, rótulos e pesos.
 */
export function colunasDeParticipantes(
  tipo: AtaTypeDefinition,
  dados: Record<string, string>,
): ColunaParticipante[] {
  const papel: ColunaParticipante[] =
    tipo.rotuloPapel === null
      ? []
      : [{ id: 'papel', rotulo: tipo.rotuloPapel, peso: PESOS_COLUNA.papel, campo: null }];
  const extras = tipo.camposParticipante
    .filter((campo) => ehVisivel(campo, dados))
    .map((campo): ColunaParticipante => ({
      id: campo.id,
      rotulo: rotuloDoCampo(campo, dados),
      peso: campo.peso ?? PESOS_COLUNA.extra,
      campo,
    }));
  return [
    { id: 'nome', rotulo: 'Nome', peso: PESOS_COLUNA.nome, campo: null },
    ...papel,
    ...extras,
    { id: 'presenca', rotulo: 'Presença', peso: PESOS_COLUNA.presenca, campo: null },
  ];
}

/**
 * `dados` que lança ao tocar um id fora de `permitidos` (a cópia enviada à IA só tem esses): ler
 * (`dados.x`), testar (`'x' in dados`, `Object.hasOwn`) ou enumerar (`Object.keys`, `Object.entries`, espalhar),
 * porque enumerar veria só a cópia e esconderia a dependência dos demais campos.
 */
function dadosSoDoPrompt(permitidos: ReadonlySet<string>): Record<string, string> {
  const conferir = (chave: string | symbol): void => {
    if (typeof chave === 'string' && !permitidos.has(chave)) {
      throw new Error(`lê “${chave}”, que não está em camposNoPrompt`);
    }
  };
  return new Proxy<Record<string, string>>(
    {},
    {
      get(_alvo, chave) {
        conferir(chave);
        return undefined;
      },
      has(_alvo, chave) {
        conferir(chave);
        return false;
      },
      getOwnPropertyDescriptor(_alvo, chave) {
        conferir(chave);
        return undefined;
      },
      ownKeys() {
        throw new Error('enumera os dados, que a cópia enviada à IA não garante');
      },
    },
  );
}

/** Mensagem de falha de um `visivelSe` executado sobre `dadosSoDoPrompt`, ou `null` se não houve. */
function falhaDoVisivelSe(campo: CampoDef, permitidos: ReadonlySet<string>): string | null {
  try {
    campo.visivelSe?.(dadosSoDoPrompt(permitidos));
    return null;
  } catch (erro) {
    return erro instanceof Error ? erro.message : 'falha desconhecida';
  }
}

/**
 * Entrada "cheia" só para provar invariantes dos tipos: todo campo preenchido (primeira opção nos
 * de escolha) e dois participantes presentes com todos os extras preenchidos.
 */
function entradaDeProva(tipo: AtaTypeDefinition): EntradaDoDocumento {
  const valorDe = (c: CampoDef): string =>
    c.opcoes?.[0]?.valor ?? (c.tipo === 'data' ? '2026-01-15' : c.tipo === 'hora' ? '10:00' : 'x');
  const extras = Object.fromEntries(tipo.camposParticipante.map((c) => [c.id, valorDe(c)]));
  return {
    dados: Object.fromEntries(tipo.campos.map((c) => [c.id, valorDe(c)])),
    pauta: ['x'],
    participantes: ['a', 'b'].map((id) => ({
      id,
      nome: `Pessoa ${id}`,
      papel: 'x',
      presenca: 'presente',
      justificativa: '',
      extras,
    })),
    resultado: null,
  };
}

/** Problema dos grupos de assinatura do tipo (sobre `entradaDeProva`), ou `null`. */
function problemaDeAssinaturas(tipo: AtaTypeDefinition): string | null {
  try {
    const grupos = tipo.assinaturas(entradaDeProva(tipo)).filter((g) => g.pessoas.length > 0);
    if (grupos.length > 1 && grupos.some((g) => (g.titulo ?? '').trim() === '')) {
      return `${tipo.id}: com mais de um grupo de assinaturas, todos precisam de título (a região “Assinaturas” do documento se repetiria).`;
    }
    return null;
  } catch {
    return `${tipo.id}: assinaturas lança com uma entrada completa.`;
  }
}

/** As `opcoes` de um contêm as do outro (em qualquer direção). */
function opcoesContidas(a: CampoDef, b: CampoDef): boolean {
  const va = (a.opcoes ?? []).map((o) => o.valor);
  const vb = (b.opcoes ?? []).map((o) => o.valor);
  return va.every((v) => vb.includes(v)) || vb.every((v) => va.includes(v));
}

/**
 * Invariantes do registro; `[]` = ok. (a) Um id presente em 2+ tipos (em `campos` ou em
 * `camposParticipante`) tem o mesmo `tipo` e, se `escolha`, opções contidas umas nas outras:
 * mesmo id = mesmo significado, para a troca de tipo preservar o valor. (b) Ids de `campos` e de
 * `camposParticipante` não colidem. (c) `campoComplemento` é id de extra de texto, sem `visivelSe`. (d) Todo id de
 * `camposNoPrompt` existe em `campos` e o `visivelSe` desses campos, e o dos extras de participante
 * com `enviarParaIA`, só toca ids dessa lista (ler, testar com `in`/`Object.hasOwn` ou enumerar).
 * (e) Com mais de um grupo de assinaturas (para uma entrada completa), todos têm título.
 */
export function problemasDoRegistro(tipos: readonly AtaTypeDefinition[]): string[] {
  const problemas: string[] = [];
  const porId = new Map<string, { tipoId: string; campo: CampoDef }[]>();

  for (const tipo of tipos) {
    const idsDeCampos = new Set(tipo.campos.map((c) => c.id));
    for (const extra of tipo.camposParticipante) {
      if (idsDeCampos.has(extra.id)) {
        problemas.push(`${tipo.id}: o id “${extra.id}” está em campos e em camposParticipante.`);
      }
    }
    for (const campo of [...tipo.campos, ...tipo.camposParticipante]) {
      porId.set(campo.id, [...(porId.get(campo.id) ?? []), { tipoId: tipo.id, campo }]);
    }

    if (tipo.campoComplemento !== undefined) {
      const extra = tipo.camposParticipante.find((c) => c.id === tipo.campoComplemento);
      if (extra?.tipo !== 'texto') {
        problemas.push(
          `${tipo.id}: campoComplemento “${tipo.campoComplemento}” não é um campo de participante de texto.`,
        );
      } else if (extra.visivelSe !== undefined) {
        problemas.push(
          `${tipo.id}: campoComplemento “${extra.id}” não pode ter visivelSe (o complemento colado ficaria escondido).`,
        );
      }
    }

    const problemaAssinaturas = problemaDeAssinaturas(tipo);
    if (problemaAssinaturas !== null) problemas.push(problemaAssinaturas);

    const noPrompt = new Set(tipo.camposNoPrompt);
    for (const id of tipo.camposNoPrompt) {
      if (!idsDeCampos.has(id)) {
        problemas.push(`${tipo.id}: camposNoPrompt cita “${id}”, que não existe em campos.`);
      }
    }
    const lidosPelaIA = [
      ...tipo.campos.filter((c) => noPrompt.has(c.id)),
      ...tipo.camposParticipante.filter((c) => c.enviarParaIA === true),
    ];
    for (const campo of lidosPelaIA) {
      const motivo = falhaDoVisivelSe(campo, noPrompt);
      if (motivo !== null) problemas.push(`${tipo.id}: o visivelSe de “${campo.id}” ${motivo}.`);
    }
  }

  for (const [id, ocorrencias] of porId) {
    for (const [i, a] of ocorrencias.entries()) {
      for (const b of ocorrencias.slice(i + 1)) {
        if (a.tipoId === b.tipoId) continue;
        if (a.campo.tipo !== b.campo.tipo) {
          problemas.push(
            `“${id}” é ${a.campo.tipo} em ${a.tipoId} e ${b.campo.tipo} em ${b.tipoId}.`,
          );
        } else if (a.campo.tipo === 'escolha' && !opcoesContidas(a.campo, b.campo)) {
          problemas.push(
            `“${id}” tem opções incompatíveis entre ${a.tipoId} e ${b.tipoId}: nenhuma contém a outra.`,
          );
        }
      }
    }
  }
  return problemas;
}

/** Transcrição acima de `LIMITE_TRANSCRICAO`: bloqueia a geração e pinta o contador do bloco. */
export function transcricaoExcedeLimite(texto: string): boolean {
  return texto.length > LIMITE_TRANSCRICAO;
}

/**
 * Tudo que ainda impede a ata de sair completa, na ordem do formulário. Fonte única do bloqueio
 * da geração: os blocos e a barra de geração leem daqui (inclusive o limite da transcrição).
 * `campo` é o id que a tela usa em `data-campo` para levar o foco ao campo (`focar-campo.ts`).
 * Campos de `dados` e extras de participante passam por `problemaDoCampo`; há uma falta por
 * campo, nunca uma por participante (vazio vence "corrigir").
 */
export function camposFaltando(d: AtaDraft, tipo: AtaTypeDefinition): CampoFaltando[] {
  const faltas: CampoFaltando[] = [];

  for (const campo of tipo.campos) {
    const problema = problemaDoCampo(campo, d.dados[campo.id], d.dados);
    if (problema) {
      faltas.push({
        bloco: 'dados',
        campo: campo.id,
        rotulo: rotuloDaFalta(campo, problema, d.dados),
      });
    }
  }
  if (!d.pauta.some((item) => item.trim() !== '')) {
    faltas.push({ bloco: 'dados', campo: 'pauta', rotulo: tipo.rotulos.pauta });
  }

  if (!d.participantes.some((p) => p.presenca === 'presente')) {
    faltas.push({
      bloco: 'participantes',
      campo: 'participantes',
      rotulo: 'Participante presente',
    });
  }
  if (d.participantes.some((p) => p.nome.trim() === '')) {
    faltas.push({ bloco: 'participantes', campo: 'nome', rotulo: 'Nome do participante' });
  }
  for (const campo of tipo.camposParticipante) {
    const problemas = d.participantes.map((p) =>
      problemaDoCampo(campo, p.extras[campo.id], d.dados),
    );
    const problema =
      problemas.find((x) => x?.tipo === 'vazio') ?? problemas.find((x) => x !== null) ?? null;
    if (problema) {
      faltas.push({
        bloco: 'participantes',
        campo: campo.id,
        rotulo: rotuloDaFalta(campo, problema, d.dados),
      });
    }
  }

  if (d.transcricao.trim() === '') {
    faltas.push({ bloco: 'transcricao', campo: 'transcricao', rotulo: 'Transcrição' });
  } else if (transcricaoExcedeLimite(d.transcricao)) {
    // Mesmo campo: vazia e acima do limite nunca acontecem juntas.
    faltas.push({
      bloco: 'transcricao',
      campo: 'transcricao',
      rotulo: 'Transcrição dentro do limite',
    });
  }
  return faltas;
}
