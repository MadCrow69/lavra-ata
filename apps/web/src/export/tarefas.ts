import { dataOuNulo, prazoOuNulo, textoLimpo } from '../ata-types/texto-modelo';
import { CELULA_VAZIA, RESPONSAVEL_A_DEFINIR } from '../config/documento';
import { ROTULO_STATUS, type Encaminhamento } from '../domain/draft';
import { plural } from '../ui/plural';

export interface GrupoDeTarefas {
  /** Grafia da primeira ocorrência, aparada; `RESPONSAVEL_A_DEFINIR` no grupo sem responsável. */
  responsavel: string;
  semResponsavel: boolean;
  itens: Encaminhamento[];
}

const COLACAO = 'pt-BR';
const TITULO_TAREFAS = 'Tarefas por responsável';

/** Aparado, NFC, espaços internos colapsados. É a grafia exibida. */
function nomeExibido(responsavel: string): string {
  return textoLimpo(responsavel).normalize('NFC').replace(/\s+/gu, ' ');
}

/**
 * Chave de agrupamento: o nome digitado é a única chave possível, então normaliza só espaço, caixa
 * e NFC. Nunca remove acento nem junta grafias diferentes ("Jose"/"José", "Ana"/"Ana Souza").
 */
function chaveDoResponsavel(nome: string): string {
  return nome.toLocaleLowerCase(COLACAO);
}

const CHAVE_A_DEFINIR = chaveDoResponsavel(nomeExibido(RESPONSAVEL_A_DEFINIR));

/**
 * Agrupa as tarefas por responsável. Ordem determinística: grupos nomeados por
 * `localeCompare('pt-BR')` do nome exibido (empate → ordem de aparição, pois o `sort` é estável);
 * o grupo sem responsável (vazio ou "A definir") vem sempre por último; itens na ordem da ata.
 */
export function agruparPorResponsavel(itens: Encaminhamento[]): GrupoDeTarefas[] {
  const nomeados = new Map<string, GrupoDeTarefas>();
  const sem: GrupoDeTarefas = {
    responsavel: RESPONSAVEL_A_DEFINIR,
    semResponsavel: true,
    itens: [],
  };

  for (const item of itens) {
    const nome = nomeExibido(item.responsavel);
    const chave = chaveDoResponsavel(nome);
    if (chave === '' || chave === CHAVE_A_DEFINIR) {
      sem.itens.push(item);
      continue;
    }
    const grupo = nomeados.get(chave);
    if (grupo) grupo.itens.push(item);
    else nomeados.set(chave, { responsavel: nome, semResponsavel: false, itens: [item] });
  }

  const grupos = [...nomeados.values()].sort((a, b) =>
    a.responsavel.localeCompare(b.responsavel, COLACAO),
  );
  return sem.itens.length > 0 ? [...grupos, sem] : grupos;
}

function linhaDaTarefa(item: Encaminhamento): string {
  const acao = textoLimpo(item.acao) || CELULA_VAZIA;
  const prazo = prazoOuNulo(item.prazo);
  const status = item.status === 'pendente' ? undefined : ROTULO_STATUS[item.status];
  return `- ${acao}${prazo === null ? '' : ` (prazo: ${prazo})`}${status ? ` — ${status}` : ''}`;
}

/**
 * Texto puro das tarefas por responsável, para a área de transferência. Todas as tarefas entram,
 * com o status visível (concluída e cancelada não somem). Título vazio e data inválida omitem a
 * respectiva linha. `pessoas` conta os grupos nomeados; `semResponsavel`, as tarefas sem dono.
 */
export function textoDasTarefas(
  titulo: string,
  dataIso: string | undefined,
  itens: Encaminhamento[],
): { texto: string; pessoas: number; semResponsavel: number } {
  const grupos = agruparPorResponsavel(itens);
  const data = dataOuNulo(dataIso);

  const cabecalho: string[] = [];
  const tituloLimpo = textoLimpo(titulo);
  if (tituloLimpo !== '') cabecalho.push(tituloLimpo);
  if (data !== null) cabecalho.push(`Reunião de ${data}`);
  if (cabecalho.length > 0) cabecalho.push('');
  cabecalho.push(TITULO_TAREFAS);

  const blocos = [
    cabecalho.join('\n'),
    ...grupos.map((g) => [g.responsavel, ...g.itens.map(linhaDaTarefa)].join('\n')),
  ];

  return {
    texto: blocos.join('\n\n'),
    pessoas: grupos.filter((g) => !g.semResponsavel).length,
    semResponsavel: grupos.find((g) => g.semResponsavel)?.itens.length ?? 0,
  };
}

/** Aviso (aria-live) depois de copiar: diz quantas pessoas e quantas tarefas sem dono saíram. */
export function mensagemTarefasCopiadas(r: { pessoas: number; semResponsavel: number }): string {
  const { pessoas, semResponsavel } = r;
  if (pessoas === 0 && semResponsavel === 0) return 'Nenhuma tarefa para copiar.';
  const semDono = String(semResponsavel);
  if (pessoas === 0) {
    return `${semDono} ${plural(semResponsavel, 'tarefa', 'tarefas')} sem responsável definido ${plural(semResponsavel, 'copiada', 'copiadas')}.`;
  }
  const base = `Tarefas de ${String(pessoas)} ${plural(pessoas, 'pessoa', 'pessoas')} copiadas`;
  return semResponsavel > 0 ? `${base} (${semDono} sem responsável definido).` : `${base}.`;
}
