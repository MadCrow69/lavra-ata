import { describe, expect, it } from 'vitest';
import { partesDoRodape } from './rodape';

describe('partesDoRodape', () => {
  it('fatia {pagina} e {total}', () => {
    expect(partesDoRodape('Página {pagina} de {total}')).toEqual([
      { tipo: 'texto', texto: 'Página ' },
      { tipo: 'pagina' },
      { tipo: 'texto', texto: ' de ' },
      { tipo: 'total' },
    ]);
  });

  it('sem marcadores devolve um único texto', () => {
    expect(partesDoRodape('Ata')).toEqual([{ tipo: 'texto', texto: 'Ata' }]);
  });

  it('modelo vazio devolve lista vazia', () => {
    expect(partesDoRodape('')).toEqual([]);
  });

  it('marcador desconhecido fica como texto', () => {
    expect(partesDoRodape('{x} {pagina}')).toEqual([
      { tipo: 'texto', texto: '{x} ' },
      { tipo: 'pagina' },
    ]);
  });

  it('marcadores colados não geram texto vazio', () => {
    expect(partesDoRodape('{pagina}{total}')).toEqual([{ tipo: 'pagina' }, { tipo: 'total' }]);
  });
});
