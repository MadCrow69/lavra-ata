import { describe, expect, it } from 'vitest';
import {
  analisarLista,
  contarRepetidos,
  descreverAdicao,
  descreverPreenchimento,
  normalizarBusca,
} from './lista-participantes';

describe('analisarLista', () => {
  it('um nome por linha, ignorando linhas vazias e espaços', () => {
    expect(analisarLista('  Ana Souza \n\n   \nBruno Lima\r\n')).toEqual([
      { nome: 'Ana Souza', complemento: '' },
      { nome: 'Bruno Lima', complemento: '' },
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
      { nome: 'Ana Souza', complemento: 'Diretora' },
      { nome: 'Bruno Lima', complemento: 'Analista' },
      { nome: 'Carla Dias', complemento: 'Gerente' },
      { nome: 'Davi Reis', complemento: 'Coordenador' },
      { nome: 'Eva Melo', complemento: 'Sócia' },
    ]);
  });

  it('hífen sem espaços faz parte do nome', () => {
    expect(analisarLista('Ana-Maria Souza')).toEqual([
      { nome: 'Ana-Maria Souza', complemento: '' },
    ]);
  });

  it('só o primeiro separador divide; o resto fica no cargo', () => {
    expect(analisarLista('Ana — Diretora — Financeiro')).toEqual([
      { nome: 'Ana', complemento: 'Diretora — Financeiro' },
    ]);
  });

  it('remove marcadores de lista e numeração coladas', () => {
    expect(analisarLista('- Ana Souza\n• Bruno Lima\n3. Carla Dias\n2) Davi Reis')).toEqual([
      { nome: 'Ana Souza', complemento: '' },
      { nome: 'Bruno Lima', complemento: '' },
      { nome: 'Carla Dias', complemento: '' },
      { nome: 'Davi Reis', complemento: '' },
    ]);
  });

  it('linha só com separador não vira participante', () => {
    expect(analisarLista('—\n - \nAna')).toEqual([{ nome: 'Ana', complemento: '' }]);
  });
});

describe('normalizarBusca', () => {
  it('ignora acentos e caixa', () => {
    expect(normalizarBusca('  JOÃO da Conceição ')).toBe('joao da conceicao');
  });
});

describe('contarRepetidos', () => {
  const l = (nome: string, complemento = ''): { nome: string; complemento: string } => ({
    nome,
    complemento,
  });

  it('compara sem caixa, sem acento e sem espaços nas pontas', () => {
    expect(
      contarRepetidos(
        [l('  JOAO da conceicao'), l('Ana'), l('Zé')],
        [l('João da Conceição'), l('Bia')],
      ),
    ).toBe(1);
  });

  it('lista vazia não tem repetidos', () => {
    expect(contarRepetidos([l('Ana')], [])).toBe(0);
  });

  it('repetido = mesmo nome E mesmo complemento (normalizados)', () => {
    expect(contarRepetidos([l('Ana', 'Apto 101')], [l('ana', 'apto 101')])).toBe(1);
    expect(contarRepetidos([l('Ana', 'Apto 101')], [l('Ana', 'Apto 102')])).toBe(0);
    expect(contarRepetidos([l('Ana', 'Apto 101')], [l('Ana')])).toBe(0);
  });

  it('sem complemento dos dois lados, só o nome conta (comportamento atual)', () => {
    expect(contarRepetidos([l('Ana')], [l('ANA')])).toBe(1);
  });
});

describe('descreverPreenchimento', () => {
  it('plural e singular', () => {
    expect(descreverPreenchimento('Vínculo', 'Proprietário(a)', 200)).toBe(
      'Vínculo “Proprietário(a)” aplicado a 200 participantes sem valor.',
    );
    expect(descreverPreenchimento('Vínculo', 'Proprietário(a)', 1)).toBe(
      'Vínculo “Proprietário(a)” aplicado a 1 participante sem valor.',
    );
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
