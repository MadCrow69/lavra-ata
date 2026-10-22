import { corporativa } from '../ata-types/corporativa';
import type { AtaTypeDefinition } from '../ata-types/types';
import { construirDocumento } from '../document/build-model';
import type { DocumentModel, LogoDoc } from '../document/model';
import {
  STATUS_ENCAMINHAMENTO,
  type EntradaDoDocumento,
  type Encaminhamento,
  type Participante,
  type ResultadoAta,
} from '../domain/draft';

/** PNG 1×1 válido (um pixel azul-petróleo, com CRC e zlib corretos): a logo mínima dos testes. */
export const LOGO_TESTE: LogoDoc = {
  dataUrl:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGOQ9Yv/DwADIAHKOkpCAwAAAABJRU5ErkJggg==',
  largura: 1,
  altura: 1,
};

/** Quantos responsáveis distintos os encaminhamentos de volume repetem em rodízio. */
const RESPONSAVEIS_DE_VOLUME = 50;

/** "João Decomposto" colado de outro app: o "ã" chega como "a" + til combinante (NFD). */
export const NOME_DECOMPOSTO = 'João Decomposto'.normalize('NFD');

/** Nome com letras fora do latin básico (cobertas pela segunda família de fonte do PDF). */
export const NOME_LATIN_EXT = 'Łukasz Żółć';

const tres = (i: number) => String(i).padStart(3, '0');
const dois = (i: number) => String(i).padStart(2, '0');

function participante(
  id: string,
  nome: string,
  i: number,
  extras: Record<string, string> = {},
): Participante {
  const justificado = i % 7 === 0;
  return {
    id,
    nome,
    papel: 'Cargo de volume',
    presenca: justificado ? 'justificado' : 'presente',
    justificativa: justificado ? 'Viagem a trabalho' : '',
    extras,
  };
}

function encaminhamento(i: number): Encaminhamento {
  return {
    acao: `Tarefa de volume nº ${tres(i)} — revisar orçamento`,
    responsavel: `Responsável ${dois(((i - 1) % RESPONSAVEIS_DE_VOLUME) + 1)}`,
    prazo: '2026-10-30',
    status: STATUS_ENCAMINHAMENTO[(i - 1) % STATUS_ENCAMINHAMENTO.length] ?? 'pendente',
  };
}

export interface OpcoesVolume {
  participantes: number;
  encaminhamentos: number;
  logo?: boolean;
  /** Ausente = corporativa com o conteúdo de hoje (testes existentes intactos). */
  tipo?: AtaTypeDefinition;
  /** `dados` do formulário; ausente = os da corporativa de volume (sem `tipo`) ou `{}`. */
  dados?: Record<string, string>;
  /** Extras do participante de número `i` (1, 2, …); os dois nomes especiais usam `i` 1 e 2. */
  extras?: (i: number) => Record<string, string>;
}

const DADOS_CORPORATIVA: Record<string, string> = {
  organizacao: 'Cooperativa Fictícia',
  assunto: 'Orçamento anual',
  data: '2026-10-14',
  inicio: '14:30',
  fim: '16:00',
  modalidade: 'presencial',
  local: 'Sala de reuniões',
  conducao: 'Ana Souza',
  redacao: 'Bruno Lima',
};

const ATRIBUICAO_DE_VOLUME = { provedor: 'gemini', modelo: 'modelo-de-teste', falhas: [] } as const;

const PARAGRAFO_COM_LACUNA = 'A reunião ocorreu em [PREENCHER: local] e tratou do orçamento anual.';

/** Seções da corporativa de volume (o conteúdo de sempre dos testes de exportação). */
function secoesDaCorporativa(): Pick<ResultadoAta, 'secoes' | 'atribuicao'> {
  return {
    secoes: {
      resumo: [{ tipo: 'paragrafo', texto: PARAGRAFO_COM_LACUNA, itens: [] }],
      discussao: [],
      decisoes: [{ tipo: 'lista', texto: '', itens: ['Aprovar o orçamento', 'Rever o fluxo'] }],
      pendencias: [],
      riscos: [],
      proxima_reuniao: [],
    },
    atribuicao: {
      resumo: { ...ATRIBUICAO_DE_VOLUME, falhas: [] },
      decisoes: { ...ATRIBUICAO_DE_VOLUME, falhas: [] },
    },
  };
}

/** Um parágrafo por seção do tipo (o primeiro com `[PREENCHER: local]`), todas atribuídas à IA. */
function secoesDoTipo(tipo: AtaTypeDefinition): Pick<ResultadoAta, 'secoes' | 'atribuicao'> {
  return {
    secoes: Object.fromEntries(
      tipo.secoes.map((s, k) => [
        s.chave,
        [
          {
            tipo: 'paragrafo',
            texto: k === 0 ? PARAGRAFO_COM_LACUNA : `Texto de volume da seção ${s.titulo}.`,
            itens: [],
          },
        ],
      ]),
    ),
    atribuicao: Object.fromEntries(
      tipo.secoes.map((s) => [s.chave, { ...ATRIBUICAO_DE_VOLUME, falhas: [] }]),
    ),
  };
}

/**
 * Rascunho de ata já gerada, para os testes de volume da exportação: `participantes` linhas
 * "Participante de volume nº 001 — João Ação"… seguidas de dois nomes especiais (latin-ext e
 * NFD), `encaminhamentos` tarefas com 50 responsáveis em rodízio e prazo 2026-10-30. Sem `tipo`,
 * é a corporativa de sempre (resumo com `[PREENCHER: local]` e decisões em lista); com `tipo`,
 * um parágrafo por seção dele (o primeiro com `[PREENCHER: local]`). Tem autoria de IA
 * (`atribuicao`), então `rodapeInterno` existe — os arquivos exportados não podem trazê-lo.
 */
export function rascunhoDeVolume(o: OpcoesVolume): EntradaDoDocumento {
  const extras = (i: number) => o.extras?.(i) ?? {};
  const participantes = Array.from({ length: o.participantes }, (_, k) =>
    participante(
      `p${tres(k + 1)}`,
      `Participante de volume nº ${tres(k + 1)} — João Ação`,
      k + 1,
      extras(k + 1),
    ),
  );
  participantes.push(
    participante('p-latin-ext', NOME_LATIN_EXT, 1, extras(1)),
    participante('p-nfd', NOME_DECOMPOSTO, 2, extras(2)),
  );

  const resultado: ResultadoAta = {
    ...(o.tipo === undefined ? secoesDaCorporativa() : secoesDoTipo(o.tipo)),
    encaminhamentos: Array.from({ length: o.encaminhamentos }, (_, k) => encaminhamento(k + 1)),
    avisos: {},
    editadas: [],
  };

  return {
    dados: { ...(o.dados ?? (o.tipo === undefined ? DADOS_CORPORATIVA : {})) },
    pauta: ['Orçamento', 'Encaminhamentos'],
    participantes,
    resultado,
  };
}

/** `construirDocumento` do rascunho de volume, com o próprio tipo (padrão: corporativa). */
export function modeloDeVolume(o: OpcoesVolume): DocumentModel {
  return construirDocumento(
    rascunhoDeVolume(o),
    o.tipo ?? corporativa,
    o.logo === true ? LOGO_TESTE : null,
  );
}
