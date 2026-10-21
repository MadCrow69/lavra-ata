import { corporativa } from '../ata-types/corporativa';
import { construirDocumento } from '../document/build-model';
import type { DocumentModel, LogoDoc } from '../document/model';
import {
  STATUS_ENCAMINHAMENTO,
  type Encaminhamento,
  type Participante,
  type ResultadoAta,
} from '../domain/draft';
import { criarRascunho } from '../domain/draft-reducer';

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

function participante(id: string, nome: string, i: number): Participante {
  const justificado = i % 7 === 0;
  return {
    id,
    nome,
    papel: 'Cargo de volume',
    presenca: justificado ? 'justificado' : 'presente',
    justificativa: justificado ? 'Viagem a trabalho' : '',
    extras: {},
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

/**
 * Ata corporativa já gerada, para os testes de volume da exportação: `participantes` linhas
 * "Participante de volume nº 001 — João Ação"… seguidas de dois nomes especiais (latin-ext e
 * NFD), `encaminhamentos` tarefas com 50 responsáveis em rodízio e prazo 2026-10-30, e um resumo
 * com `[PREENCHER: local]`. Tem autoria de IA (`atribuicao`), então `rodapeInterno` existe — os
 * arquivos exportados não podem trazê-lo.
 */
export function modeloDeVolume(n: {
  participantes: number;
  encaminhamentos: number;
  logo?: boolean;
}): DocumentModel {
  const participantes = Array.from({ length: n.participantes }, (_, k) =>
    participante(`p${tres(k + 1)}`, `Participante de volume nº ${tres(k + 1)} — João Ação`, k + 1),
  );
  participantes.push(
    participante('p-latin-ext', NOME_LATIN_EXT, 1),
    participante('p-nfd', NOME_DECOMPOSTO, 2),
  );

  const resultado: ResultadoAta = {
    secoes: {
      resumo: [
        {
          tipo: 'paragrafo',
          texto: 'A reunião ocorreu em [PREENCHER: local] e tratou do orçamento anual.',
          itens: [],
        },
      ],
      discussao: [],
      decisoes: [{ tipo: 'lista', texto: '', itens: ['Aprovar o orçamento', 'Rever o fluxo'] }],
      pendencias: [],
      riscos: [],
      proxima_reuniao: [],
    },
    encaminhamentos: Array.from({ length: n.encaminhamentos }, (_, k) => encaminhamento(k + 1)),
    atribuicao: {
      resumo: { provedor: 'gemini', modelo: 'modelo-de-teste', falhas: [] },
      decisoes: { provedor: 'gemini', modelo: 'modelo-de-teste', falhas: [] },
    },
    avisos: {},
    editadas: [],
  };

  const rascunho = {
    ...criarRascunho(corporativa.id),
    dados: {
      organizacao: 'Cooperativa Fictícia',
      assunto: 'Orçamento anual',
      data: '2026-10-14',
      inicio: '14:30',
      fim: '16:00',
      modalidade: 'presencial',
      local: 'Sala de reuniões',
      conducao: 'Ana Souza',
      redacao: 'Bruno Lima',
    },
    pauta: ['Orçamento', 'Encaminhamentos'],
    participantes,
    resultado,
  };

  return construirDocumento(rascunho, corporativa, n.logo === true ? LOGO_TESTE : null);
}
