import { describe, expect, it } from 'vitest';
import { analisarLista, normalizarBusca } from './lista-participantes';

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
