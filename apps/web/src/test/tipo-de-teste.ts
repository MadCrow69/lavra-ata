import { ATA_TYPES } from '../ata-types/registry';
import { dataOuNulo, preencher, textoLimpo } from '../ata-types/texto-modelo';
import type { AtaTypeDefinition, CampoDef } from '../ata-types/types';
import type { EntradaDoDocumento } from '../domain/draft';

/**
 * Tipo FIXO só para testes (nunca registrado fora deles): exercita o que a corporativa não usa —
 * sem coluna de papel, extras de participante com validação, flag de envio à IA e peso, grupos de
 * assinatura, avisos finais, resumo e campo condicional. Reutilizado pelos testes dos Tasks 1 a 3.
 */

const OPCOES_NATUREZA = [
  { valor: 'ordinaria', rotulo: 'Ordinária' },
  { valor: 'extraordinaria', rotulo: 'Extraordinária' },
];

const OPCOES_VINCULO = [
  { valor: 'proprietario', rotulo: 'Proprietário(a)' },
  { valor: 'procurador', rotulo: 'Procurador(a)' },
];

const CAMPOS: CampoDef[] = [
  { id: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true },
  {
    id: 'natureza',
    rotulo: 'Natureza',
    tipo: 'escolha',
    obrigatorio: true,
    opcoes: OPCOES_NATUREZA,
  },
  {
    id: 'motivo',
    rotulo: 'Motivo da reunião extraordinária',
    tipo: 'texto',
    obrigatorio: false,
    visivelSe: (dados) => dados.natureza === 'extraordinaria',
    obrigatorioSe: (dados) => dados.natureza === 'extraordinaria',
  },
  {
    id: 'modalidade',
    rotulo: 'Modalidade',
    tipo: 'escolha',
    obrigatorio: true,
    opcoes: [
      { valor: 'presencial', rotulo: 'Presencial' },
      { valor: 'hibrida', rotulo: 'Híbrida' },
    ],
  },
  {
    id: 'codigo',
    rotulo: 'Código',
    tipo: 'texto',
    obrigatorio: false,
    validar: (valor) => (/^\d+$/.test(valor) ? null : 'Use só números.'),
    teclado: 'numeric',
  },
  { id: 'presidente', rotulo: 'Presidente', tipo: 'texto', obrigatorio: false },
];

const CAMPOS_PARTICIPANTE: CampoDef[] = [
  {
    id: 'unidade',
    rotulo: 'Unidade',
    tipo: 'texto',
    obrigatorio: true,
    peso: 1.5,
    validar: (valor) => (/\d/.test(valor) ? null : 'Informe a unidade com número (ex.: Apto 101).'),
  },
  {
    id: 'vinculo',
    rotulo: 'Vínculo',
    tipo: 'escolha',
    obrigatorio: true,
    opcoes: OPCOES_VINCULO,
    enviarParaIA: true,
    peso: 2,
  },
  { id: 'fracao', rotulo: 'Fração ideal', tipo: 'texto', obrigatorio: false },
];

function assinaturas(d: EntradaDoDocumento): ReturnType<AtaTypeDefinition['assinaturas']> {
  const presidente = textoLimpo(d.dados.presidente);
  const mesa = presidente === '' ? [] : [{ nome: presidente, papel: 'Presidente' }];
  const presentes = d.participantes
    .filter((p) => p.presenca === 'presente')
    .map((p) => ({
      nome: textoLimpo(p.nome),
      papel: OPCOES_VINCULO.find((o) => o.valor === p.extras.vinculo)?.rotulo ?? '',
    }));
  return [
    ...(mesa.length > 0 ? [{ titulo: 'Mesa', pessoas: mesa }] : []),
    ...(presentes.length > 0 ? [{ titulo: 'Membros presentes', pessoas: presentes }] : []),
  ];
}

export const TIPO_DE_TESTE: AtaTypeDefinition = {
  id: 'teste-formal',
  rotulo: 'Tipo de teste',
  descricao: 'Tipo fictício usado só nos testes.',
  campos: CAMPOS,
  camposParticipante: CAMPOS_PARTICIPANTE,
  rotuloPapel: null,
  campoComplemento: 'unidade',
  rotulos: { participantes: 'Membros', pauta: 'Ordem do dia' },
  secoes: [
    {
      chave: 'abertura',
      titulo: 'Abertura',
      instrucao: 'Registre a abertura da reunião.',
    },
    {
      chave: 'deliberacoes',
      titulo: 'Deliberações',
      instrucao: 'Registre as deliberações declaradas.',
    },
  ],
  temEncaminhamentos: true,
  camposNoPrompt: ['data', 'natureza', 'motivo', 'modalidade'],
  regrasPrompt: ['Regra fixa do tipo de teste.'],
  titulo: () => 'Ata de teste',
  cabecalho: (d) => {
    const data = dataOuNulo(d.dados.data);
    return data === null ? [] : [`Data: ${data}`];
  },
  preambulo: (d) =>
    `Reunião em ${dataOuNulo(d.dados.data) ?? preencher('data')}, conforme os membros a seguir.`,
  fecho: () => 'Nada mais havendo a tratar, encerrou-se a reunião.',
  assinaturas,
  avisosFinais: () => ['Aviso final de teste.'],
  resumoDosParticipantes: ({ participantes }) => {
    const presentes = participantes.filter((p) => p.presenca === 'presente').length;
    return {
      texto: `${String(participantes.length)} unidades informadas`,
      alertas: presentes < 2 ? ['Menos de dois membros presentes.'] : [],
    };
  },
};

/** Insere o tipo de teste em `ATA_TYPES`; devolve a limpeza (chame em `afterEach`). */
export function registrarTipoDeTeste(): () => void {
  ATA_TYPES[TIPO_DE_TESTE.id] = TIPO_DE_TESTE;
  return () => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete ATA_TYPES[TIPO_DE_TESTE.id];
  };
}
