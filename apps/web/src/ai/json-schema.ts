import type { JsonSchema } from './types';

function rotuloDoTipo(valor: unknown): string {
  if (valor === null) return 'nulo';
  if (Array.isArray(valor)) return 'lista';
  switch (typeof valor) {
    case 'string':
      return 'texto';
    case 'object':
      return 'objeto';
    default:
      return typeof valor;
  }
}

const ROTULO_ESPERADO: Record<JsonSchema['type'], string> = {
  object: 'objeto',
  array: 'lista',
  string: 'texto',
};

function validar(valor: unknown, schema: JsonSchema, caminho: string, problemas: string[]): void {
  const onde = caminho === '' ? 'raiz' : caminho;

  switch (schema.type) {
    case 'string': {
      if (typeof valor !== 'string') {
        problemas.push(`${onde}: esperado ${ROTULO_ESPERADO.string}, veio ${rotuloDoTipo(valor)}`);
        return;
      }
      if (schema.enum && !schema.enum.includes(valor)) {
        problemas.push(`${onde}: valor "${valor}" fora de ${schema.enum.join(', ')}`);
      }
      return;
    }
    case 'array': {
      if (!Array.isArray(valor)) {
        problemas.push(`${onde}: esperado ${ROTULO_ESPERADO.array}, veio ${rotuloDoTipo(valor)}`);
        return;
      }
      const itens = schema.items;
      if (itens) {
        valor.forEach((item: unknown, i) => {
          validar(item, itens, `${caminho}[${String(i)}]`, problemas);
        });
      }
      return;
    }
    case 'object': {
      if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
        problemas.push(`${onde}: esperado ${ROTULO_ESPERADO.object}, veio ${rotuloDoTipo(valor)}`);
        return;
      }
      const registro = valor as Record<string, unknown>;
      const propriedades = schema.properties ?? {};
      for (const nome of schema.required ?? []) {
        if (!(nome in registro))
          problemas.push(`${juntar(caminho, nome)}: campo obrigatório ausente`);
      }
      for (const [nome, filho] of Object.entries(registro)) {
        const esquema = Object.hasOwn(propriedades, nome) ? propriedades[nome] : undefined;
        if (esquema) validar(filho, esquema, juntar(caminho, nome), problemas);
        else if (schema.additionalProperties === false) {
          problemas.push(`${juntar(caminho, nome)}: campo não previsto`);
        }
      }
    }
  }
}

function juntar(caminho: string, nome: string): string {
  return caminho === '' ? nome : `${caminho}.${nome}`;
}

/** Valida `valor` contra o subconjunto de JSON Schema do Lavra. Devolve os problemas; [] = válido. */
export function validarSchema(valor: unknown, schema: JsonSchema): string[] {
  const problemas: string[] = [];
  validar(valor, schema, '', problemas);
  return problemas;
}
