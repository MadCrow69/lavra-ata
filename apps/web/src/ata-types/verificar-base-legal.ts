import { dataOuNulo } from './texto-modelo';
import type { AtaTypeDefinition } from './types';

/**
 * Guarda que liga `textosFixos` dos tipos formais a `docs/base-legal.md` (puro: recebe o texto do
 * Markdown). Cada texto fixo precisa de uma linha que aponte a norma, com link oficial e data da
 * consulta; cada linha precisa de um texto fixo que exista.
 */

/** Únicos hosts aceitos em links: os sítios oficiais onde as normas foram lidas. */
export const HOSTS_OFICIAIS: readonly string[] = ['www.planalto.gov.br', 'www.gov.br'];

/** Data da pesquisa jurídica do Plano 05; nenhuma consulta registrada pode ser anterior. */
export const PRIMEIRA_CONSULTA_ISO = '2026-10-21';

const COLUNAS = ['Chave', 'Trecho do template', 'Norma (artigo/item)', 'Link oficial', 'Consulta'];

interface LinhaDaTabela {
  secao: string;
  numero: number;
  celulas: string[];
}

/** Células de uma linha `| a | b |`, respeitando `\|` dentro da célula. */
function celulas(linha: string): string[] {
  const miolo = linha.trim().replace(/^\|/, '').replace(/\|$/, '');
  return miolo.split(/(?<!\\)\|/).map((c) => c.trim());
}

function problemasDeLinks(md: string): string[] {
  const problemas: string[] = [];
  for (const [link] of md.matchAll(/https?:\/\/[^\s)<>\]|]+/gi)) {
    if (/^http:/i.test(link)) {
      problemas.push(`Link sem HTTPS: ${link}. Use o endereço https:// do sítio oficial.`);
      continue;
    }
    let host: string;
    try {
      host = new URL(link).hostname;
    } catch {
      problemas.push(`Link malformado: ${link}.`);
      continue;
    }
    if (!HOSTS_OFICIAIS.includes(host)) {
      problemas.push(
        `Link fora das fontes oficiais: ${link}. Só valem ${HOSTS_OFICIAIS.join(' e ')}.`,
      );
    }
  }
  return problemas;
}

/** Linhas de dados das tabelas que começam com `| Chave`, com a seção `## ` em que estão. */
function linhasDasTabelas(md: string): LinhaDaTabela[] {
  const linhas: LinhaDaTabela[] = [];
  let secao = '';
  let naTabela = false;
  for (const [indice, bruta] of md.split(/\r?\n/).entries()) {
    const linha = bruta.trim();
    if (/^##\s/.test(linha)) secao = linha.replace(/^##\s+/, '').trim();
    if (!linha.startsWith('|')) {
      naTabela = false;
      continue;
    }
    if (/^\|\s*Chave\s*\|/.test(linha)) {
      naTabela = true;
      continue;
    }
    if (!naTabela || /^\|\s*:?-{3,}/.test(linha)) continue;
    linhas.push({ secao, numero: indice + 1, celulas: celulas(linha) });
  }
  return linhas;
}

/** `dd/mm/aaaa` existente e não anterior a `PRIMEIRA_CONSULTA_ISO`. */
function consultaValida(texto: string): boolean {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!m) return false;
  const iso = `${m[3] ?? ''}-${m[2] ?? ''}-${m[1] ?? ''}`;
  return dataOuNulo(iso) !== null && iso >= PRIMEIRA_CONSULTA_ISO;
}

/** Problemas de formato de uma linha e a chave citada (se legível). */
function conferirLinha(linha: LinhaDaTabela): { chave: string | null; problemas: string[] } {
  const onde = `Linha ${String(linha.numero)} (seção “${linha.secao}”)`;
  if (linha.celulas.length !== COLUNAS.length) {
    return {
      chave: null,
      problemas: [
        `${onde}: tem ${String(linha.celulas.length)} células; a tabela pede ${String(COLUNAS.length)} (${COLUNAS.join(', ')}).`,
      ],
    };
  }
  const problemas: string[] = [];
  linha.celulas.forEach((celula, i) => {
    if (celula === '') problemas.push(`${onde}: a célula “${COLUNAS[i] ?? ''}” está vazia.`);
  });
  const [celulaChave = '', , , link = '', consulta = ''] = linha.celulas;
  const chave = /^`([^`]+)`$/.exec(celulaChave)?.[1] ?? null;
  if (celulaChave !== '' && chave === null) {
    problemas.push(`${onde}: a chave “${celulaChave}” precisa estar entre crases.`);
  }
  if (link !== '' && !link.includes('https://')) {
    problemas.push(`${onde}: a célula “Link oficial” não tem link https://.`);
  }
  if (consulta !== '' && !consultaValida(consulta)) {
    problemas.push(
      `${onde}: a consulta “${consulta}” precisa ser uma data dd/mm/aaaa a partir de ${dataOuNulo(PRIMEIRA_CONSULTA_ISO) ?? PRIMEIRA_CONSULTA_ISO}.`,
    );
  }
  return { chave, problemas };
}

/**
 * Problemas de `docs/base-legal.md` em relação aos tipos registrados; `[]` = ok. Regras: todo link
 * é `https://` de um host oficial; só as tabelas com cabeçalho `| Chave` são lidas; cada linha tem
 * as 5 células preenchidas, a chave entre crases, link https e consulta `dd/mm/aaaa` válida a
 * partir de `PRIMEIRA_CONSULTA_ISO`; cada tipo com `textosFixos` tem a seção `## {rotulo}`, toda chave dele
 * aparece numa linha dessa seção e toda linha cita uma chave existente. Uma tabela de chaves numa
 * seção sem tipo correspondente também é problema (tipo renomeado ou removido). Tipos sem
 * `textosFixos` (a corporativa) não entram.
 */
export function verificarBaseLegal(md: string, tipos: readonly AtaTypeDefinition[]): string[] {
  const problemas = problemasDeLinks(md);
  const formais = tipos.filter((t) => t.textosFixos !== undefined);
  const secoes = new Set(
    md
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^##\s/.test(l))
      .map((l) => l.replace(/^##\s+/, '').trim()),
  );

  const chavesPorSecao = new Map<string, Set<string>>();
  for (const linha of linhasDasTabelas(md)) {
    const conferida = conferirLinha(linha);
    problemas.push(...conferida.problemas);
    if (conferida.chave === null) continue;
    const chaves = chavesPorSecao.get(linha.secao) ?? new Set<string>();
    chaves.add(conferida.chave);
    chavesPorSecao.set(linha.secao, chaves);
  }

  const rotulosFormais = new Set(formais.map((t) => t.rotulo));
  for (const secao of chavesPorSecao.keys()) {
    if (!rotulosFormais.has(secao)) {
      problemas.push(
        `Seção “${secao}” tem tabela de chaves, mas nenhum tipo com textosFixos tem esse rótulo (seção órfã).`,
      );
    }
  }

  for (const tipo of formais) {
    if (!secoes.has(tipo.rotulo)) {
      problemas.push(`Falta a seção “## ${tipo.rotulo}” para os textos fixos do tipo ${tipo.id}.`);
      continue;
    }
    const citadas = chavesPorSecao.get(tipo.rotulo) ?? new Set<string>();
    const existentes = Object.keys(tipo.textosFixos ?? {});
    for (const chave of existentes) {
      if (!citadas.has(chave)) {
        problemas.push(`${tipo.rotulo}: o texto fixo “${chave}” não tem linha com a norma.`);
      }
    }
    for (const chave of citadas) {
      if (!existentes.includes(chave)) {
        problemas.push(
          `${tipo.rotulo}: a linha da chave “${chave}” é órfã (o tipo não tem esse texto fixo).`,
        );
      }
    }
  }
  return problemas;
}
