import { describe, expect, it } from 'vitest';
import { createMaskMap, mask, MARKER_PATTERN, unmask } from '../src/mask';
import { CORPUS } from './corpus';

// Montado por código: o arquivo não carrega caractere invisível.
const ZWSP = String.fromCharCode(0x200b);

describe('mask / unmask', () => {
  it('troca por marcadores e reidrata', () => {
    const t = 'CPF 529.982.247-25, fone (11) 98888-7777';
    const { masked, map } = mask(t);
    expect(masked).toBe('CPF [CPF_1], fone [TELEFONE_1]');
    expect(unmask(masked, map)).toBe(t);
  });
  it('mesmo valor, formatos diferentes', () => {
    const { masked } = mask('529.982.247-25 e de novo 52998224725');
    expect(masked).toBe('[CPF_1] e de novo [CPF_1]');
  });
  it('reaproveita mapa entre chamadas', () => {
    const a = mask('529.982.247-25');
    const b = mask('outro 111.444.777-35 e 529.982.247-25', { map: a.map });
    expect(b.masked).toBe('outro [CPF_2] e [CPF_1]');
    expect(a.map.counters.CPF).toBe(1); // não mutou
  });
  it('unmask tolera grafias alternativas', () => {
    const { map } = mask('529.982.247-25');
    expect(unmask('[cpf_1] [CPF 1] [CPF-1]', map)).toBe(
      '529.982.247-25 529.982.247-25 529.982.247-25',
    );
  });
  it('unmask mantém marcador desconhecido', () => {
    expect(unmask('[CPF_9]', createMaskMap())).toBe('[CPF_9]');
  });
  it('mapa é JSON puro', () => {
    const { map } = mask('maria@exemplo.com');
    expect(JSON.parse(JSON.stringify(map))).toEqual(map);
  });
  it('ida e volta preserva corpus inteiro', () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(20);
    for (const t of CORPUS) expect(unmask(mask(t).masked, mask(t).map)).toBe(t);
  });
  it('corpus: nenhum valor sensível sobra no texto mascarado', () => {
    for (const t of CORPUS) {
      const { masked, findings } = mask(t);
      for (const f of findings) expect(masked).not.toContain(f.value);
    }
  });
});

describe('mask: mapa e estado', () => {
  it('createMaskMap devolve mapa vazio novo a cada chamada', () => {
    expect(createMaskMap()).toEqual({ version: 1, markers: {}, keys: {}, counters: {} });
    expect(createMaskMap()).not.toBe(createMaskMap());
  });
  it('não muta o mapa recebido (nenhum campo)', () => {
    const a = mask('529.982.247-25');
    const antes = JSON.stringify(a.map);
    const b = mask('111.444.777-35 e maria@exemplo.com', { map: a.map });
    expect(JSON.stringify(a.map)).toBe(antes);
    expect(b.map).not.toBe(a.map);
    expect(b.map.markers).not.toBe(a.map.markers);
    expect(b.map.keys).not.toBe(a.map.keys);
    expect(b.map.counters).not.toBe(a.map.counters);
  });
  it('markers guarda o PRIMEIRO texto original visto', () => {
    const { map } = mask('52998224725 e depois 529.982.247-25');
    expect(map.markers['[CPF_1]']).toBe('52998224725');
  });
  it('contadores independentes por tipo', () => {
    const { masked, map } = mask('529.982.247-25 a@exemplo.com 111.444.777-35 b@exemplo.com');
    expect(masked).toBe('[CPF_1] [EMAIL_1] [CPF_2] [EMAIL_2]');
    expect(map.counters).toEqual({ CPF: 2, EMAIL: 2 });
  });
  it('mesmo número em tipos diferentes não colide', () => {
    const { map } = mask('CEP 01310-100 e CPF 529.982.247-25');
    expect(Object.keys(map.keys).sort()).toEqual(['CEP:01310100', 'CPF:52998224725']);
  });
  it('respeita options.types e devolve os findings', () => {
    const { masked, findings } = mask('529.982.247-25 e a@exemplo.com', { types: ['EMAIL'] });
    expect(masked).toBe('529.982.247-25 e [EMAIL_1]');
    expect(findings.map((f) => f.type)).toEqual(['EMAIL']);
  });
  it('texto vazio e sem identificadores', () => {
    expect(mask('').masked).toBe('');
    expect(mask('nada aqui').masked).toBe('nada aqui');
  });
});

describe('unmask: robustez', () => {
  it('valor restaurado com forma de marcador não é reprocessado', () => {
    const map = createMaskMap();
    map.markers['[CPF_1]'] = '[CPF_2]';
    map.markers['[CPF_2]'] = 'outro';
    expect(unmask('[CPF_1]', map)).toBe('[CPF_2]');
  });
  it('valor restaurado com "$" é literal', () => {
    const map = createMaskMap();
    const valor = "a$&b$1$'@exemplo.com";
    map.markers['[EMAIL_1]'] = valor;
    expect(unmask('x [EMAIL_1] y', map)).toBe(`x ${valor} y`);
  });
  it('chaves herdadas de Object não viram marcador', () => {
    expect(unmask('[CONSTRUCTOR_1] [TOSTRING_1]', createMaskMap())).toBe(
      '[CONSTRUCTOR_1] [TOSTRING_1]',
    );
  });
  it('tolera espaços internos e é repetível (sem estado de regex global)', () => {
    const { map } = mask('529.982.247-25');
    for (let i = 0; i < 3; i++) {
      expect(unmask('[ CPF_1 ] [CPF_1]', map)).toBe('529.982.247-25 529.982.247-25');
    }
  });
  it('MARKER_PATTERN é o canônico global e não é consumido pelo unmask', () => {
    expect(MARKER_PATTERN.source).toBe('\\[([A-Z]+)_(\\d+)\\]');
    expect(MARKER_PATTERN.flags).toBe('g');
    const { map } = mask('529.982.247-25');
    MARKER_PATTERN.lastIndex = 7;
    unmask('[CPF_1]', map);
    expect(MARKER_PATTERN.lastIndex).toBe(7);
    MARKER_PATTERN.lastIndex = 0;
  });
});

describe('mask: texto do usuário com forma de marcador', () => {
  it('marcador literal do usuário nunca é trocado por dado de outra pessoa', () => {
    const a = mask('cliente 529.982.247-25');
    const entrada = 'o usuário escreveu [CPF_1] literalmente';
    const { masked, map } = mask(entrada, { map: a.map });
    expect(masked).not.toMatch(MARKER_PATTERN); // o LLM não vê marcador falso
    expect(unmask(masked, map)).toBe(entrada);
    expect(unmask(masked, map)).not.toContain('529.982.247-25');
  });
  it('literal escapado convive com marcador real no mesmo texto', () => {
    const entrada = '[CPF_1] e 529.982.247-25';
    const { masked, map } = mask(entrada);
    expect(masked).toBe(`[${ZWSP}CPF_1] e [CPF_1]`);
    expect(unmask(masked, map)).toBe(entrada);
  });
  it('grafias tolerantes do usuário também são escapadas', () => {
    for (const lit of ['[cpf_1]', '[CPF 1]', '[ CPF-1 ]']) {
      const { masked, map } = mask(`x ${lit} y`);
      expect(unmask(masked, map)).toBe(`x ${lit} y`);
    }
  });
  it('texto do usuário que já contém o escape também faz ida e volta', () => {
    for (const lit of [`[${ZWSP}CPF_1]`, `[${ZWSP}${ZWSP}CPF_1]`]) {
      const { masked, map } = mask(`a ${lit} b 529.982.247-25`);
      expect(unmask(masked, map)).toBe(`a ${lit} b 529.982.247-25`);
    }
  });
  it('não escapa colchetes que não têm forma de marcador', () => {
    expect(mask('lista [a, b] e [item 3x] e [1]').masked).toBe('lista [a, b] e [item 3x] e [1]');
  });
});
