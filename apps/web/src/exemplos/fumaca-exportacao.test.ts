// @vitest-environment node
import { extractText } from 'unpdf';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ATA_TYPES, obterTipo } from '../ata-types/registry';
import { AVISO_MINUTA } from '../config/documento';
import { construirDocumento } from '../document/build-model';
import type { DocumentModel } from '../document/model';
import { gerarDocx } from '../export/docx/gerar-docx';
import { caracteresSemFonte } from '../export/pdf/cobertura';
import { gerarPdf } from '../export/pdf/gerar-pdf';
import { xmlDoDocx } from '../test/docx-xml';
import { TEMPO_VOLUME_MS } from '../test/tempos';
import { carregarExemplo, rascunhoDoExemplo } from './carregar';

/**
 * Fumaça do exemplo de cada tipo (spec 7.8): o que a pessoa vê ao clicar em "Ver exemplo" vira PDF
 * e DOCX sem aviso de caractere sem fonte e com os textos-chave. Tudo derivado do modelo; sem logo
 * (o Node não tem canvas). Só o aviso do pdfmake no Node é aceito (ver tipos-exportacao.test.ts).
 */
const AVISO_ACESSO_LOCAL = 'No local access policy defined.';

const espacos = (texto: string) => texto.replace(/\s+/g, ' ');
const lerPdf = async (pdf: Blob) =>
  espacos((await extractText(new Uint8Array(await pdf.arrayBuffer()), { mergePages: true })).text);

describe.each(Object.keys(ATA_TYPES))('fumaça de exportação · exemplo %s', (tipoId) => {
  const tipo = obterTipo(tipoId);
  let modelo: DocumentModel;
  let esperados: string[];
  let pdf: Blob;
  let textoPdf: string;
  let partesDocx: Map<string, string>;
  const avisosInesperados: unknown[][] = [];

  beforeAll(async () => {
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].startsWith(AVISO_ACESSO_LOCAL)) return;
      avisosInesperados.push(args);
    });
    const rascunho = rascunhoDoExemplo(await carregarExemplo(tipoId));
    modelo = construirDocumento(rascunho, tipo);
    const primeiraSecao = modelo.blocos.find((b) => b.tipo === 'secao' && b.gerada);
    esperados = [
      modelo.titulo,
      rascunho.participantes[0]?.nome ?? '',
      primeiraSecao?.tipo === 'secao' ? primeiraSecao.titulo : '',
      rascunho.resultado?.encaminhamentos[0]?.acao ?? '',
      AVISO_MINUTA.slice(0, 40),
    ].map(espacos);
    pdf = await gerarPdf(modelo);
    textoPdf = await lerPdf(pdf);
    partesDocx = await xmlDoDocx(await gerarDocx(modelo));
  }, TEMPO_VOLUME_MS);

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('os textos esperados existem e não precisam de escape no XML', () => {
    expect(esperados).toHaveLength(5);
    for (const texto of esperados) {
      expect(texto.length, 'texto esperado vazio').toBeGreaterThan(0);
      expect(texto, texto).not.toMatch(/[&<>]/);
    }
  });

  it('todo caractere do exemplo tem fonte no PDF', () => {
    expect(caracteresSemFonte(modelo)).toEqual([]);
  });

  it('PDF: começa com %PDF- e traz os textos-chave e a paginação', async () => {
    expect(new TextDecoder().decode(new Uint8Array(await pdf.arrayBuffer()).slice(0, 5))).toBe(
      '%PDF-',
    );
    for (const texto of esperados) expect(textoPdf, texto).toContain(texto);
    expect(textoPdf).toContain('Página 1 de');
    expect(avisosInesperados).toEqual([]);
  });

  it('DOCX: o document.xml traz os textos-chave e o rodapé, a paginação', () => {
    const documento = partesDocx.get('word/document.xml') ?? '';
    for (const texto of esperados) expect(documento, texto).toContain(texto);
    const rodapes = [...partesDocx]
      .filter(([caminho]) => /^word\/footer\d*\.xml$/.test(caminho))
      .map(([, xml]) => xml)
      .join('\n');
    expect(rodapes).toContain('Página');
  });

  it('com destaque "vinho", PDF e DOCX também são gerados', async () => {
    const colorido = construirDocumento(
      rascunhoDoExemplo(await carregarExemplo(tipoId)),
      tipo,
      null,
      'vinho',
    );
    expect(colorido.corDestaque).not.toBe(modelo.corDestaque);
    const arquivoPdf = await gerarPdf(colorido);
    expect(arquivoPdf.size).toBeGreaterThan(0);
    const docx = await xmlDoDocx(await gerarDocx(colorido));
    expect(docx.get('word/document.xml') ?? '').toContain(colorido.titulo);
    expect(avisosInesperados).toEqual([]);
  });
});
