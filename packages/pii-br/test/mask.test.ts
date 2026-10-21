import { describe, expect, it } from 'vitest';
import { createMaskMap, mask, MARKER_PATTERN, unmask } from '../src/mask';
import type { MaskMap } from '../src/types';
import { detect } from '../src/detect';
import { normalizeValue } from '../src/normalize';
import { CORPUS, FALSOS_POSITIVOS } from './corpus';

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
  it('falsos positivos clássicos passam intactos', () => {
    for (const t of FALSOS_POSITIVOS) {
      const r = mask(t);
      expect(r.masked).toBe(t);
      expect(r.findings).toEqual([]);
    }
  });
  it('um único mapa compartilhado pelo corpus inteiro reidrata com o mesmo significado', () => {
    // Formato do restaurado = primeiro visto; compara-se o valor normalizado, não o texto.
    const chaves = (t: string): string[] =>
      detect(t).map((f) => `${f.type}:${normalizeValue(f.type, f.value)}`);
    let map = createMaskMap();
    const mascarados: string[] = [];
    const todasColisoes: string[] = [];
    for (const t of CORPUS) {
      const r = mask(t, { map });
      map = r.map;
      mascarados.push(r.masked);
      todasColisoes.push(...r.collisions);
    }
    CORPUS.forEach((t, i) => {
      expect(chaves(unmask(mascarados[i] ?? '', map))).toEqual(chaves(t));
    });
    // O único literal que colide é o `[CPF_1]` da frase de exemplo (CPF_1 já alocado antes).
    expect(todasColisoes).toEqual(['[CPF_1]']);
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
    expect(createMaskMap()).toEqual({
      version: 1,
      markers: {},
      keys: {},
      counters: {},
      reserved: {},
    });
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
  it('literal + CPF real na mesma chamada: o real pula o número do literal, sem caractere invisível', () => {
    const entrada = '[CPF_1] e 529.982.247-25';
    const { masked, map, collisions } = mask(entrada);
    expect(masked).toBe('[CPF_1] e [CPF_2]');
    expect(collisions).toEqual([]);
    expect(map.counters.CPF).toBe(2);
    expect(Object.keys(map.markers)).toEqual(['[CPF_2]']); // o literal nunca entra no mapa
    expect(unmask(masked, map)).toBe(entrada);
    expect(masked).toMatch(/^[ -~]*$/); // só ASCII visível
  });
  it('eco do LLM com o literal continua literal', () => {
    const { map } = mask('[CPF_1] e 529.982.247-25');
    expect(unmask('o LLM repetiu [CPF_1] e também [cpf 1] e [CPF_2]', map)).toBe(
      'o LLM repetiu [CPF_1] e também [cpf 1] e 529.982.247-25',
    );
  });
  it('variantes de grafia reservam o mesmo número; zeros à esquerda são outro número', () => {
    for (const lit of ['[cpf 1]', '[ CPF-1 ]', '[Cpf' + String.fromCharCode(10) + '1]']) {
      const { masked, map } = mask(`${lit} 529.982.247-25`);
      expect(masked).toBe(`${lit} [CPF_2]`);
      expect(unmask(masked, map)).toBe(`${lit} 529.982.247-25`);
    }
    // [CPF_01] != [CPF_1]: não reserva o 1
    expect(mask('[CPF_01] 529.982.247-25').masked).toBe('[CPF_01] [CPF_1]');
    // reserva vale por tipo e pula números consecutivos
    expect(
      mask('[cpf 3] [CPF_1] [TELEFONE_1] 529.982.247-25 111.444.777-35 (11) 98888-7777').masked,
    ).toBe('[cpf 3] [CPF_1] [TELEFONE_1] [CPF_2] [CPF_4] [TELEFONE_2]');
  });
  it('número gigante não passa por Number', () => {
    const lit = '[CPF_99999999999999999999]';
    const { masked, map } = mask(`${lit} 529.982.247-25`);
    expect(masked).toBe(`${lit} [CPF_1]`);
    expect(unmask(masked, map)).toBe(`${lit} 529.982.247-25`);
  });
  it('colisão com marcador já alocado: vira [CPF#1], visível, e é reportada', () => {
    const a = mask('cliente 529.982.247-25');
    const entrada = 'o usuário escreveu [CPF_1] e [cpf 1] literalmente; novo 111.444.777-35';
    const { masked, map, collisions } = mask(entrada, { map: a.map });
    expect(masked).toBe('o usuário escreveu [CPF#1] e [cpf#1] literalmente; novo [CPF_2]');
    expect(collisions).toEqual(['[CPF_1]', '[cpf 1]']);
    const volta = unmask(masked, map);
    expect(volta).not.toContain('529.982.247-25'); // nada do cliente anterior
    expect(volta).toBe('o usuário escreveu [CPF#1] e [cpf#1] literalmente; novo 111.444.777-35');
  });
  it('unmask deixa [CPF#1] em paz (o # não é aceito pela forma tolerante)', () => {
    const { map } = mask('529.982.247-25');
    expect(unmask('[CPF#1] [cpf#1] [CPF # 1]', map)).toBe('[CPF#1] [cpf#1] [CPF # 1]');
  });
  it('sem colisão, collisions vem vazio', () => {
    expect(mask('529.982.247-25').collisions).toEqual([]);
  });
  it('colchetes de outros tipos passam intactos', () => {
    const t = 'ver [Anexo 2] e [item 3x] e [1] e [lista a, b] e [XYZ_1]';
    const { masked, map } = mask(t);
    expect(masked).toBe(t);
    expect(unmask(masked, map)).toBe(t);
    // mesmo com mapa que tenha marcador homônimo de tipo desconhecido, nada é reservado/pulado
    expect(mask('[Anexo 2] 529.982.247-25').masked).toBe('[Anexo 2] [CPF_1]');
  });
  it('reserva persiste no mapa: literal da chamada 1 nunca é alocado na 3', () => {
    const c1 = mask('[CPF_2] e 529.982.247-25');
    expect(c1.masked).toBe('[CPF_2] e [CPF_1]');
    expect(c1.map.reserved).toEqual({ CPF: ['2'] });
    const novos = mask('111.444.777-35 e 000.000.001-91', { map: c1.map });
    expect(novos.masked).toBe('[CPF_3] e [CPF_4]'); // o 2 foi pulado
    expect(novos.map.reserved).toEqual({ CPF: ['2'] });
    // reidratar a saída da chamada 1 com o mapa final mantém o literal
    expect(unmask(c1.masked, novos.map)).toBe('[CPF_2] e 529.982.247-25');
    expect(c1.map.reserved).toEqual({ CPF: ['2'] }); // mapa recebido não foi mutado
  });
  it('reservas se acumulam sem duplicar, por tipo, e sobrevivem a JSON', () => {
    const a = mask('[CPF_2] [cpf 2] [TELEFONE_1]');
    const b = mask('[CPF_5] [CPF_2]', { map: JSON.parse(JSON.stringify(a.map)) as MaskMap });
    expect(b.map.reserved).toEqual({ CPF: ['2', '5'], TELEFONE: ['1'] });
    expect(a.map.reserved).toEqual({ CPF: ['2'], TELEFONE: ['1'] });
  });
  it('aceita mapa antigo sem `reserved`', () => {
    const antigo = { version: 1, markers: {}, keys: {}, counters: {} } as MaskMap;
    const r = mask('[CPF_1] 529.982.247-25', { map: antigo });
    expect(r.masked).toBe('[CPF_1] [CPF_2]');
    expect(r.map.reserved).toEqual({ CPF: ['1'] });
    expect('reserved' in antigo).toBe(false);
  });
  it('mapa sem literais não ganha tipos em `reserved`', () => {
    expect(mask('529.982.247-25').map.reserved).toEqual({});
  });
});

describe('mask: cartão com grupo anexo (CVV)', () => {
  it('o mesmo cartão com CVVs diferentes recebe marcadores diferentes e a volta é exata', () => {
    const t = 'cartão 4111 1111 1111 1111 123 e depois 4111 1111 1111 1111 456';
    const { masked, map } = mask(t);
    expect(masked).toBe('cartão [CARTAO_1] e depois [CARTAO_2]');
    expect(unmask(masked, map)).toBe(t);
  });
  it('o mesmo cartão com o mesmo CVV reaproveita o marcador', () => {
    const { masked } = mask('4111-1111-1111-1111-123 e 4111 1111 1111 1111 123');
    expect(masked).toBe('[CARTAO_1] e [CARTAO_1]');
  });
});
