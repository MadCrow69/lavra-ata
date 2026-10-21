import { describe, expect, it } from 'vitest';
import {
  analisarLista,
  contarRepetidos,
  descreverAdicao,
  normalizarBusca,
} from './lista-participantes';

describe('analisarLista', () => {
  it('um nome por linha, ignorando linhas vazias e espaços', () => {
    expect(analisarLista('  Ana Souza \n\n   \nBruno Lima\r\n')).toEqual([
      { nome: 'Ana Souza', papel: '' },
      { nome: 'Bruno Lima', papel: '' },
    ]);
  });

  it('separa nome e cargo por travessão, meia-risca, hífen com espaços e tabulação', () => {
    expect(
      analisarLista(
        [
          'Ana Souza — Diretora',
          'Bruno Lima – Analista',
          'Carla Dias - Gerente',
          'Davi Reis\tCoordenador',
          'Eva Melo—Sócia',
        ].join('\n'),
      ),
    ).toEqual([
      { nome: 'Ana Souza', papel: 'Diretora' },
      { nome: 'Bruno Lima', papel: 'Analista' },
      { nome: 'Carla Dias', papel: 'Gerente' },
      { nome: 'Davi Reis', papel: 'Coordenador' },
      { nome: 'Eva Melo', papel: 'Sócia' },
    ]);
  });

  it('hífen sem espaços faz parte do nome', () => {
    expect(analisarLista('Ana-Maria Souza')).toEqual([{ nome: 'Ana-Maria Souza', papel: '' }]);
  });

  it('só o primeiro separador divide; o resto fica no cargo', () => {
    expect(analisarLista('Ana — Diretora — Financeiro')).toEqual([
      { nome: 'Ana', papel: 'Diretora — Financeiro' },
    ]);
  });

  it('remove marcadores de lista e numeração coladas', () => {
    expect(analisarLista('- Ana Souza\n• Bruno Lima\n3. Carla Dias\n2) Davi Reis')).toEqual([
      { nome: 'Ana Souza', papel: '' },
      { nome: 'Bruno Lima', papel: '' },
      { nome: 'Carla Dias', papel: '' },
      { nome: 'Davi Reis', papel: '' },
    ]);
  });

  it('linha só com separador não vira participante', () => {
    expect(analisarLista('—\n - \nAna')).toEqual([{ nome: 'Ana', papel: '' }]);
  });
});

describe('normalizarBusca', () => {
  it('ignora acentos e caixa', () => {
    expect(normalizarBusca('  JOÃO da Conceição ')).toBe('joao da conceicao');
  });
});

describe('contarRepetidos', () => {
  it('compara sem caixa, sem acento e sem espaços nas pontas', () => {
    expect(
      contarRepetidos(['  JOAO da conceicao', 'Ana', 'Zé'], ['João da Conceição', 'Bia']),
    ).toBe(1);
  });

  it('lista vazia não tem repetidos', () => {
    expect(contarRepetidos(['Ana'], [])).toBe(0);
  });
});

describe('descreverAdicao', () => {
  it('só adicionados', () => {
    expect(descreverAdicao({ adicionados: 1, ignorados: 0, repetidos: 0 })).toBe(
      '1 participante adicionado.',
    );
  });

  it('avisa os que já estavam na lista', () => {
    expect(descreverAdicao({ adicionados: 12, ignorados: 0, repetidos: 3 })).toBe(
      '12 participantes adicionados · 3 já estavam na lista (mantidos em duplicidade — remova se não for o caso).',
    );
    expect(descreverAdicao({ adicionados: 2, ignorados: 0, repetidos: 1 })).toBe(
      '2 participantes adicionados · 1 já estava na lista (mantido em duplicidade — remova se não for o caso).',
    );
  });

  it('junta repetidos e limite', () => {
    expect(descreverAdicao({ adicionados: 0, ignorados: 2, repetidos: 0 })).toBe(
      'Nenhum nome foi adicionado. 2 nomes ignorados: o limite é 500 participantes.',
    );
  });
});
