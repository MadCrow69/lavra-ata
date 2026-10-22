import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarRascunho } from '../domain/draft-reducer';
import type { AtaDraft, Participante } from '../domain/draft';
import { TIPO_DE_TESTE, registrarTipoDeTeste } from '../test/tipo-de-teste';
import { corporativa } from './corporativa';
import {
  ATA_TYPES,
  MENSAGEM_OPCAO_INVALIDA,
  camposFaltando,
  colunasDeParticipantes,
  problemaDoCampo,
  problemasDoRegistro,
  rotuloDaOpcao,
} from './registry';
import type { AtaTypeDefinition, CampoDef } from './types';

function campoDe(tipo: AtaTypeDefinition, id: string): CampoDef {
  const campo = [...tipo.campos, ...tipo.camposParticipante].find((c) => c.id === id);
  if (!campo) throw new Error(`campo ${id} não existe`);
  return campo;
}

function comCampo(
  tipo: AtaTypeDefinition,
  id: string,
  patch: Partial<CampoDef>,
): AtaTypeDefinition {
  return {
    ...tipo,
    campos: tipo.campos.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  };
}

function membro(id: string, extras: Record<string, string>): Participante {
  return { id, nome: `Pessoa ${id}`, papel: '', presenca: 'presente', justificativa: '', extras };
}

const DADOS_COMPLETOS = {
  data: '2026-10-14',
  natureza: 'ordinaria',
  modalidade: 'presencial',
};

function rascunhoDeTeste(sobrescrever: Partial<AtaDraft> = {}): AtaDraft {
  return {
    ...criarRascunho(TIPO_DE_TESTE.id),
    dados: { ...DADOS_COMPLETOS },
    pauta: ['Item um'],
    participantes: [
      membro('a', { unidade: 'Apto 1', vinculo: 'proprietario' }),
      membro('b', { unidade: 'Apto 2', vinculo: 'procurador' }),
    ],
    transcricao: 'Fala da reunião.',
    ...sobrescrever,
  };
}

describe('registro final do Plano 05 (piso)', () => {
  it('tem exatamente os quatro tipos, sem problemas, três deles formais', () => {
    expect(Object.keys(ATA_TYPES)).toEqual(['corporativa', 'cipa', 'condominio', 'socios-ltda']);
    expect(problemasDoRegistro(Object.values(ATA_TYPES))).toEqual([]);
    expect(Object.values(ATA_TYPES).filter((t) => t.textosFixos !== undefined)).toHaveLength(3);
  });
});

describe('problemasDoRegistro', () => {
  it('o registro real mais o tipo de teste não têm problemas', () => {
    const tipos = [...Object.values(ATA_TYPES), TIPO_DE_TESTE];
    expect(problemasDoRegistro(tipos)).toEqual([]);
    // Piso: o invariante só vale se compara de verdade — 2+ tipos com ids em comum.
    expect(tipos.length).toBeGreaterThanOrEqual(2);
    for (const id of ['data', 'modalidade']) {
      expect(tipos.filter((t) => t.campos.some((c) => c.id === id)).length).toBeGreaterThanOrEqual(
        2,
      );
    }
  });

  it('mesmo id com opções incompatíveis entre tipos é problema', () => {
    const copia = comCampo(TIPO_DE_TESTE, 'modalidade', {
      opcoes: [
        { valor: 'presencial', rotulo: 'Presencial' },
        { valor: 'online', rotulo: 'Online' },
      ],
    });
    const problemas = problemasDoRegistro([corporativa, copia]);
    expect(problemas.length).toBeGreaterThan(0);
    expect(problemas.join('\n')).toContain('modalidade');
  });

  it('mesmo id com tipo de campo diferente entre tipos é problema', () => {
    const copia = comCampo(TIPO_DE_TESTE, 'data', { tipo: 'texto' });
    expect(problemasDoRegistro([corporativa, copia]).join('\n')).toContain('data');
  });

  it('id de campo do formulário igual ao de campo de participante é problema', () => {
    const copia: AtaTypeDefinition = {
      ...TIPO_DE_TESTE,
      camposParticipante: [
        ...TIPO_DE_TESTE.camposParticipante,
        { id: 'codigo', rotulo: 'Código', tipo: 'texto', obrigatorio: false },
      ],
    };
    expect(problemasDoRegistro([copia]).join('\n')).toContain('codigo');
  });

  it('campoComplemento precisa ser extra de participante do tipo texto', () => {
    expect(
      problemasDoRegistro([{ ...TIPO_DE_TESTE, campoComplemento: 'vinculo' }]).join('\n'),
    ).toContain('vinculo');
    expect(
      problemasDoRegistro([{ ...TIPO_DE_TESTE, campoComplemento: 'inexistente' }]).length,
    ).toBeGreaterThan(0);
  });

  it('campoComplemento não pode ter visivelSe (o complemento colado não pode sumir da tela)', () => {
    const copia: AtaTypeDefinition = {
      ...TIPO_DE_TESTE,
      camposParticipante: TIPO_DE_TESTE.camposParticipante.map((c) =>
        c.id === 'unidade' ? { ...c, visivelSe: () => true } : c,
      ),
    };
    const problemas = problemasDoRegistro([copia]);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('unidade');
  });

  it('camposNoPrompt precisa apontar para campos existentes', () => {
    const copia = { ...TIPO_DE_TESTE, camposNoPrompt: ['data', 'fantasma'] };
    expect(problemasDoRegistro([copia]).join('\n')).toContain('fantasma');
  });

  it('visivelSe de campo no prompt que lê campo fora de camposNoPrompt é problema (Proxy)', () => {
    const copia = comCampo(TIPO_DE_TESTE, 'motivo', {
      visivelSe: (dados) => dados.codigo === 'x',
    });
    const problemas = problemasDoRegistro([copia]);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('motivo');
  });

  it('visivelSe que testa um id com `in` ou enumera os dados também é problema (Proxy: has e ownKeys)', () => {
    const comIn = comCampo(TIPO_DE_TESTE, 'motivo', {
      visivelSe: (dados) => 'codigo' in dados,
    });
    const problemasIn = problemasDoRegistro([comIn]);
    expect(problemasIn).toHaveLength(1);
    expect(problemasIn[0]).toContain('codigo');

    for (const leitura of [
      (dados: Record<string, string>) => Object.keys(dados).length > 0,
      (dados: Record<string, string>) => Object.entries(dados).length > 0,
      (dados: Record<string, string>) => ({ ...dados }).natureza === 'x',
    ]) {
      const problemas = problemasDoRegistro([
        comCampo(TIPO_DE_TESTE, 'motivo', { visivelSe: leitura }),
      ]);
      expect(problemas).toHaveLength(1);
      expect(problemas[0]).toContain('motivo');
    }
  });

  it('visivelSe que testa um id com Object.hasOwn também é problema (Proxy: getOwnPropertyDescriptor)', () => {
    const fora = comCampo(TIPO_DE_TESTE, 'motivo', {
      visivelSe: (dados) => Object.hasOwn(dados, 'codigo'),
    });
    const problemas = problemasDoRegistro([fora]);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('codigo');
    const dentro = comCampo(TIPO_DE_TESTE, 'motivo', {
      visivelSe: (dados) => Object.hasOwn(dados, 'natureza'),
    });
    expect(problemasDoRegistro([dentro])).toEqual([]);
  });

  it('mais de um grupo de assinaturas exige título em todos', () => {
    const pessoas = [{ nome: 'Ana', papel: 'Presidente' }];
    const semTitulo: AtaTypeDefinition = {
      ...TIPO_DE_TESTE,
      assinaturas: () => [
        { titulo: null, pessoas },
        { titulo: 'Membros', pessoas },
      ],
    };
    const problemas = problemasDoRegistro([semTitulo]);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('assinaturas');
    // Um grupo sozinho pode ficar sem título; grupo vazio não conta.
    const unico: AtaTypeDefinition = {
      ...TIPO_DE_TESTE,
      assinaturas: () => [
        { titulo: null, pessoas },
        { titulo: null, pessoas: [] },
      ],
    };
    expect(problemasDoRegistro([unico])).toEqual([]);
    const tituladosTodos: AtaTypeDefinition = {
      ...TIPO_DE_TESTE,
      assinaturas: () => [
        { titulo: 'Mesa', pessoas },
        { titulo: 'Membros', pessoas },
      ],
    };
    expect(problemasDoRegistro([tituladosTodos])).toEqual([]);
  });

  it('`in` com id de camposNoPrompt continua permitido', () => {
    const copia = comCampo(TIPO_DE_TESTE, 'motivo', {
      visivelSe: (dados) => 'natureza' in dados && dados.natureza === 'extraordinaria',
    });
    expect(problemasDoRegistro([copia])).toEqual([]);
  });

  it('extra de participante enviado à IA cujo visivelSe lê campo fora de camposNoPrompt é problema', () => {
    const copia: AtaTypeDefinition = {
      ...TIPO_DE_TESTE,
      camposParticipante: TIPO_DE_TESTE.camposParticipante.map((c) =>
        c.id === 'vinculo' ? { ...c, visivelSe: (dados) => dados.codigo === 'x' } : c,
      ),
    };
    const problemas = problemasDoRegistro([copia]);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('vinculo');
    // Um extra que NÃO vai para a IA pode ler qualquer campo: a IA nunca vê o resultado.
    const naoEnviado: AtaTypeDefinition = {
      ...TIPO_DE_TESTE,
      camposParticipante: TIPO_DE_TESTE.camposParticipante.map((c) =>
        c.id === 'fracao' ? { ...c, visivelSe: (dados) => dados.codigo === 'x' } : c,
      ),
    };
    expect(problemasDoRegistro([naoEnviado])).toEqual([]);
  });
});

describe('problemaDoCampo', () => {
  const natureza = campoDe(TIPO_DE_TESTE, 'natureza');
  const motivo = campoDe(TIPO_DE_TESTE, 'motivo');
  const modalidade = campoDe(TIPO_DE_TESTE, 'modalidade');
  const codigo = campoDe(TIPO_DE_TESTE, 'codigo');

  it('obrigatório vazio → vazio', () => {
    expect(problemaDoCampo(natureza, '', {})).toEqual({ tipo: 'vazio' });
    expect(problemaDoCampo(natureza, '   ', {})).toEqual({ tipo: 'vazio' });
    expect(problemaDoCampo(natureza, undefined, {})).toEqual({ tipo: 'vazio' });
  });

  it('opcional vazio → null', () => {
    expect(problemaDoCampo(codigo, '', {})).toBeNull();
  });

  it('obrigatoriedade condicional usa os dados', () => {
    expect(problemaDoCampo(motivo, '', { natureza: 'extraordinaria' })).toEqual({
      tipo: 'vazio',
    });
    expect(problemaDoCampo(motivo, '', { natureza: 'ordinaria' })).toBeNull();
  });

  it('obrigatoriedade condicional também num campo de texto', () => {
    const detalhe = campoDe(TIPO_DE_TESTE, 'detalhe_extra');
    expect(detalhe.tipo).toBe('texto');
    expect(problemaDoCampo(detalhe, '  ', { natureza: 'extraordinaria' })).toEqual({
      tipo: 'vazio',
    });
    expect(
      problemaDoCampo(detalhe, 'Pedido da representação', { natureza: 'extraordinaria' }),
    ).toBeNull();
    expect(problemaDoCampo(detalhe, '', { natureza: 'ordinaria' })).toBeNull();
  });

  it('campo invisível → null, mesmo vazio ou inválido', () => {
    const invisivel: CampoDef = { ...natureza, visivelSe: () => false };
    expect(problemaDoCampo(invisivel, '', {})).toBeNull();
    expect(problemaDoCampo(invisivel, 'qualquer', {})).toBeNull();
  });

  it('escolha fora de opcoes → inválido com a mensagem padrão', () => {
    expect(problemaDoCampo(modalidade, 'remota', {})).toEqual({
      tipo: 'invalido',
      mensagem: MENSAGEM_OPCAO_INVALIDA,
    });
    expect(problemaDoCampo(modalidade, 'presencial', {})).toBeNull();
  });

  it('validar ≠ null → inválido com a mensagem dele; válido → null', () => {
    expect(problemaDoCampo(codigo, '12a', {})).toEqual({
      tipo: 'invalido',
      mensagem: 'Use só números.',
    });
    expect(problemaDoCampo(codigo, '123', {})).toBeNull();
  });

  it('validar nunca é chamado com valor vazio', () => {
    const validar = vi.fn(() => 'erro');
    const campo: CampoDef = { ...codigo, validar };
    expect(problemaDoCampo(campo, '', {})).toBeNull();
    expect(problemaDoCampo(campo, '  ', {})).toBeNull();
    expect(problemaDoCampo(campo, undefined, {})).toBeNull();
    expect(validar).not.toHaveBeenCalled();
    expect(problemaDoCampo(campo, 'x', {})).not.toBeNull();
    expect(validar).toHaveBeenCalledOnce();
  });

  it('validar recebe o valor aparado e os dados', () => {
    const validar = vi.fn(() => null);
    problemaDoCampo({ ...codigo, validar }, ' 12 ', { data: 'x' });
    expect(validar).toHaveBeenCalledWith('12', { data: 'x' });
  });
});

describe('camposFaltando com extras de participante', () => {
  it('rascunho completo do tipo de teste não tem faltas', () => {
    expect(camposFaltando(rascunhoDeTeste(), TIPO_DE_TESTE)).toEqual([]);
  });

  it('uma falta por campo, nunca uma por participante', () => {
    const d = rascunhoDeTeste({
      participantes: [
        membro('a', { vinculo: 'proprietario' }),
        membro('b', { vinculo: 'proprietario' }),
        membro('c', { unidade: 'Apto 3', vinculo: 'proprietario' }),
      ],
    });
    expect(camposFaltando(d, TIPO_DE_TESTE)).toEqual([
      { bloco: 'participantes', campo: 'unidade', rotulo: 'Unidade' },
    ]);
  });

  it('valor presente porém inválido → "Rótulo (corrigir)"', () => {
    const d = rascunhoDeTeste({
      participantes: [
        membro('a', { unidade: 'Apto', vinculo: 'proprietario' }),
        membro('b', { unidade: 'Apto 2', vinculo: 'proprietario' }),
      ],
    });
    expect(camposFaltando(d, TIPO_DE_TESTE)).toEqual([
      { bloco: 'participantes', campo: 'unidade', rotulo: 'Unidade (corrigir)' },
    ]);
  });

  it('vazio e inválido no mesmo campo: uma falta só, a de vazio', () => {
    const d = rascunhoDeTeste({
      participantes: [
        membro('a', { unidade: 'Apto', vinculo: 'proprietario' }),
        membro('b', { vinculo: 'proprietario' }),
      ],
    });
    expect(camposFaltando(d, TIPO_DE_TESTE)).toEqual([
      { bloco: 'participantes', campo: 'unidade', rotulo: 'Unidade' },
    ]);
  });

  it('escolha de extra fora das opções → corrigir', () => {
    const d = rascunhoDeTeste({
      participantes: [membro('a', { unidade: 'Apto 1', vinculo: 'locatario' })],
    });
    expect(camposFaltando(d, TIPO_DE_TESTE)).toEqual([
      { bloco: 'participantes', campo: 'vinculo', rotulo: 'Vínculo (corrigir)' },
    ]);
  });

  it('motivo só falta na natureza extraordinária', () => {
    const ordinaria = rascunhoDeTeste({ dados: { ...DADOS_COMPLETOS, natureza: 'ordinaria' } });
    expect(camposFaltando(ordinaria, TIPO_DE_TESTE).map((f) => f.campo)).not.toContain('motivo');
    const extra = rascunhoDeTeste({ dados: { ...DADOS_COMPLETOS, natureza: 'extraordinaria' } });
    expect(camposFaltando(extra, TIPO_DE_TESTE)).toContainEqual({
      bloco: 'dados',
      campo: 'motivo',
      rotulo: 'Motivo da reunião extraordinária',
    });
    expect(camposFaltando(extra, TIPO_DE_TESTE)).toContainEqual({
      bloco: 'dados',
      campo: 'detalhe_extra',
      rotulo: 'Detalhe da reunião extraordinária',
    });
    expect(camposFaltando(ordinaria, TIPO_DE_TESTE).map((f) => f.campo)).not.toContain(
      'detalhe_extra',
    );
  });

  it('campo de dados com formato inválido → corrigir', () => {
    const d = rascunhoDeTeste({ dados: { ...DADOS_COMPLETOS, codigo: '12a' } });
    expect(camposFaltando(d, TIPO_DE_TESTE)).toEqual([
      { bloco: 'dados', campo: 'codigo', rotulo: 'Código (corrigir)' },
    ]);
  });
});

describe('colunasDeParticipantes', () => {
  it('corporativa: Nome, Cargo / empresa, Presença', () => {
    const colunas = colunasDeParticipantes(corporativa, {});
    expect(colunas.map((c) => c.id)).toEqual(['nome', 'papel', 'presenca']);
    expect(colunas.map((c) => c.rotulo)).toEqual(['Nome', 'Cargo / empresa', 'Presença']);
    expect(colunas.map((c) => c.campo)).toEqual([null, null, null]);
  });

  it('tipo de teste: sem papel, extras na ordem do tipo e pesos', () => {
    const colunas = colunasDeParticipantes(TIPO_DE_TESTE, {});
    expect(colunas.map((c) => c.id)).toEqual(['nome', 'unidade', 'vinculo', 'fracao', 'presenca']);
    expect(colunas.map((c) => c.rotulo)).toEqual([
      'Nome',
      'Unidade',
      'Vínculo',
      'Fração ideal',
      'Presença',
    ]);
    expect(colunas.map((c) => c.peso)).toEqual([3, 1.5, 2, 1.5, 2]);
    expect(colunas[1]?.campo).toBe(campoDe(TIPO_DE_TESTE, 'unidade'));
  });

  it('extra invisível para os dados atuais não vira coluna', () => {
    const tipo: AtaTypeDefinition = {
      ...TIPO_DE_TESTE,
      camposParticipante: TIPO_DE_TESTE.camposParticipante.map((c) =>
        c.id === 'fracao' ? { ...c, visivelSe: (dados) => dados.natureza === 'extraordinaria' } : c,
      ),
    };
    expect(colunasDeParticipantes(tipo, {}).map((c) => c.id)).not.toContain('fracao');
    expect(colunasDeParticipantes(tipo, { natureza: 'extraordinaria' }).map((c) => c.id)).toContain(
      'fracao',
    );
  });
});

describe('rotuloDaOpcao', () => {
  const modalidade = campoDe(corporativa, 'modalidade');

  it('valor conhecido → rótulo', () => {
    expect(rotuloDaOpcao(modalidade, 'remota')).toBe('Remota');
  });

  it('desconhecido, vazio, indefinido ou campo sem opções → null', () => {
    expect(rotuloDaOpcao(modalidade, 'online')).toBeNull();
    expect(rotuloDaOpcao(modalidade, '')).toBeNull();
    expect(rotuloDaOpcao(modalidade, undefined)).toBeNull();
    expect(rotuloDaOpcao(campoDe(corporativa, 'assunto'), 'remota')).toBeNull();
    expect(rotuloDaOpcao(undefined, 'remota')).toBeNull();
  });
});

describe('registrarTipoDeTeste', () => {
  const limpezas: (() => void)[] = [];
  afterEach(() => {
    for (const limpar of limpezas.splice(0)) limpar();
  });

  it('insere o tipo e a limpeza o remove', () => {
    expect(ATA_TYPES[TIPO_DE_TESTE.id]).toBeUndefined();
    const limpar = registrarTipoDeTeste();
    limpezas.push(limpar);
    expect(ATA_TYPES[TIPO_DE_TESTE.id]).toBe(TIPO_DE_TESTE);
    limpar();
    expect(ATA_TYPES[TIPO_DE_TESTE.id]).toBeUndefined();
  });
});
