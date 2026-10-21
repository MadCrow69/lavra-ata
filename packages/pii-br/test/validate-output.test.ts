import { describe, expect, it } from 'vitest';
import { createMaskMap, mask } from '../src/mask';
import { validateOutput } from '../src/validate-output';

// Nota: estes testes passam o texto original como `sentInput` (válido: o CPF é o mesmo); no uso
// real, `sentInput` é o texto MASCARADO exatamente como enviado ao modelo.
const original = 'CPF 529.982.247-25';
const { map } = mask(original);

describe('validateOutput', () => {
  it('saída limpa', () => {
    expect(validateOutput('Registrado o [CPF_1].', map, original).ok).toBe(true);
  });

  it('marcador inventado', () => {
    expect(validateOutput('[CPF_2]', map, original).unknownMarkers).toEqual(['[CPF_2]']);
  });

  it('marcador malformado', () => {
    expect(validateOutput('[CPF 1]', map, original).malformedMarkers).toEqual(['[CPF 1]']);
  });

  it('telefone inventado pela IA', () => {
    const r = validateOutput('Ligar para (11) 98888-7777', map, original);
    expect(r.newIdentifiers.map((f) => f.type)).toEqual(['TELEFONE']);
    expect(r.ok).toBe(false);
  });

  it('o marcador em si não é detectado como identificador', () => {
    const r = validateOutput('[CPF_1] [CNPJ_1] [TELEFONE_12] [RG_3] [CARTAO_1]', map, original);
    expect(r.newIdentifiers).toEqual([]);
  });

  it('identificador que já estava na entrada não é novo, mesmo em outro formato', () => {
    const r = validateOutput('Documento 52998224725.', map, original);
    expect(r.newIdentifiers).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('inventado: canônico, sem repetição, na ordem da primeira aparição', () => {
    const r = validateOutput('[CPF_3] [cnpj 1] [CPF_3] [CPF_2] [ CPF-3 ]', map, original);
    expect(r.unknownMarkers).toEqual(['[CPF_3]', '[CNPJ_1]', '[CPF_2]']);
  });

  it('malformado: como apareceu, sem repetição', () => {
    const r = validateOutput('[cpf_1] e [CPF 1] e [cpf_1] e [CPF_1]', map, original);
    expect(r.malformedMarkers).toEqual(['[cpf_1]', '[CPF 1]']);
    expect(r.unknownMarkers).toEqual([]);
    expect(r.ok).toBe(false);
  });

  it('colchetes que não são dos 9 tipos não são marcadores', () => {
    const r = validateOutput('Veja o [Anexo 2] e o [Item_3].', map, original);
    expect(r.unknownMarkers).toEqual([]);
    expect(r.malformedMarkers).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('número reservado (literal do usuário) não é marcador desconhecido', () => {
    const entrada = 'Ref [CPF_1] do CPF 529.982.247-25';
    const { masked, map: m } = mask(entrada);
    expect(masked).toBe('Ref [CPF_1] do CPF [CPF_2]');
    const r = validateOutput('Ref [CPF_1] e [CPF_2] e [CPF_3]', m, entrada);
    expect(r.unknownMarkers).toEqual(['[CPF_3]']);
    expect(r.malformedMarkers).toEqual([]);
  });

  it('reservado só vale para o seu tipo', () => {
    const entrada = 'Ref [CPF_1]';
    const { map: m } = mask(entrada);
    const r = validateOutput('[CNPJ_1] [CPF_1]', m, entrada);
    expect(r.unknownMarkers).toEqual(['[CNPJ_1]']);
  });

  it('reescrita de colisão [TIPO#N] não é desconhecida nem malformada', () => {
    const { map: m } = mask('CPF 529.982.247-25');
    const entrada = 'Ref [CPF_1] e CPF 529.982.247-25';
    const { masked, map: m2 } = mask(entrada, { map: m });
    expect(masked).toBe('Ref [CPF#1] e CPF [CPF_1]');
    const r = validateOutput('Ref [CPF#1] e [CPF_1]', m2, entrada);
    expect(r.unknownMarkers).toEqual([]);
    expect(r.malformedMarkers).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('mapa antigo sem reserved é aceito', () => {
    const m = createMaskMap();
    delete m.reserved;
    expect(validateOutput('[CPF_1]', m, '').unknownMarkers).toEqual(['[CPF_1]']);
  });

  it('número com zero à esquerda não existe no mapa: desconhecido', () => {
    expect(validateOutput('[CPF_01]', map, original).unknownMarkers).toEqual(['[CPF_01]']);
  });

  it('marcadores malformados não existentes no mapa são desconhecidos, não malformados', () => {
    const r = validateOutput('[cpf 7]', map, original);
    expect(r.unknownMarkers).toEqual(['[CPF_7]']);
    expect(r.malformedMarkers).toEqual([]);
  });

  it('vazamento de dado cru na saída é reportado quando sentInput é o texto mascarado', () => {
    const orig = 'CPF 529.982.247-25 e e-mail ana@exemplo.com.br';
    const { masked, map: m } = mask(orig);
    const saida = 'Ref 529.982.247-25 / ana@exemplo.com.br';
    const r = validateOutput(saida, m, masked);
    expect(r.newIdentifiers.map((f) => f.type)).toEqual(['CPF', 'EMAIL']);
    expect(r.ok).toBe(false);
    // com o original, o vazamento passaria despercebido
    expect(validateOutput(saida, m, orig).newIdentifiers).toEqual([]);
  });

  it('newIdentifiers sem repetição por chave normalizada', () => {
    const r = validateOutput('Ligar (11) 98888-7777 ou 11988887777', map, original);
    expect(r.newIdentifiers).toHaveLength(1);
    expect(r.newIdentifiers[0]?.value).toBe('(11) 98888-7777');
  });
});
