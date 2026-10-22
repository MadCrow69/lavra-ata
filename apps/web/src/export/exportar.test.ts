import { describe, expect, it, vi } from 'vitest';
import { COR_TEXTO_DOCUMENTO } from '../config/documento';
import type { DocumentModel } from '../document/model';
import { ErroExportacao, gerarArquivo, type CarregadoresExportacao } from './exportar';

const MODELO: DocumentModel = {
  titulo: 'Ata',
  cabecalho: { logo: null, linhas: [] },
  blocos: [],
  rodape: '',
  rodapeInterno: null,
  corDestaque: COR_TEXTO_DOCUMENTO,
};

function carregadoresFalsos(): {
  carregadores: CarregadoresExportacao;
  gerarPdf: ReturnType<typeof vi.fn<(m: DocumentModel) => Promise<Blob>>>;
  gerarDocx: ReturnType<typeof vi.fn<(m: DocumentModel) => Promise<Blob>>>;
} {
  const gerarPdf = vi.fn<(m: DocumentModel) => Promise<Blob>>(() =>
    Promise.resolve(new Blob(['pdf'])),
  );
  const gerarDocx = vi.fn<(m: DocumentModel) => Promise<Blob>>(() =>
    Promise.resolve(new Blob(['docx'])),
  );
  return {
    gerarPdf,
    gerarDocx,
    carregadores: {
      pdf: () => Promise.resolve({ gerarPdf }),
      docx: () => Promise.resolve({ gerarDocx }),
    },
  };
}

async function erroDe(promessa: Promise<unknown>): Promise<ErroExportacao> {
  try {
    await promessa;
  } catch (e) {
    if (e instanceof ErroExportacao) return e;
    throw e;
  }
  throw new Error('esperava ErroExportacao');
}

describe('gerarArquivo', () => {
  it('usa o gerador do formato pedido, com o modelo recebido', async () => {
    const { carregadores, gerarPdf, gerarDocx } = carregadoresFalsos();

    const pdf = await gerarArquivo('pdf', MODELO, carregadores);
    expect(await pdf.text()).toBe('pdf');
    expect(gerarPdf).toHaveBeenCalledWith(MODELO);
    expect(gerarDocx).not.toHaveBeenCalled();

    const docx = await gerarArquivo('docx', MODELO, carregadores);
    expect(await docx.text()).toBe('docx');
    expect(gerarDocx).toHaveBeenCalledWith(MODELO);
  });

  it('carregador que rejeita vira ErroExportacao de carregamento, com mensagem fixa', async () => {
    const { carregadores } = carregadoresFalsos();
    const erro = await erroDe(
      gerarArquivo('pdf', MODELO, {
        ...carregadores,
        pdf: () => Promise.reject(new Error('Failed to fetch dynamically imported module')),
      }),
    );
    expect(erro.motivo).toBe('carregamento');
    expect(erro.formato).toBe('pdf');
    expect(erro.message).toBe(
      'Não foi possível carregar o gerador de PDF. Verifique a conexão e recarregue a página — o rascunho desta aba fica salvo.',
    );
    expect(erro.message).not.toContain('dynamically');
  });

  it('gerador que rejeita vira ErroExportacao de geração e a mensagem não carrega o erro original', async () => {
    const { carregadores } = carregadoresFalsos();
    const erro = await erroDe(
      gerarArquivo('docx', MODELO, {
        ...carregadores,
        docx: () =>
          Promise.resolve({
            gerarDocx: () => Promise.reject(new Error('segredo 529.982.247-25')),
          }),
      }),
    );
    expect(erro.motivo).toBe('geracao');
    expect(erro.formato).toBe('docx');
    expect(erro.message).toBe(
      'Não foi possível gerar o DOCX. Tente de novo; se persistir, baixe o PDF.',
    );
    expect(erro.message).not.toContain('529.982.247-25');
    expect(erro.cause).toBeUndefined();
  });

  it('gerador que lança de forma síncrona também vira erro de geração', async () => {
    const { carregadores } = carregadoresFalsos();
    const erro = await erroDe(
      gerarArquivo('pdf', MODELO, {
        ...carregadores,
        pdf: () =>
          Promise.resolve({
            gerarPdf: () => {
              throw new Error('canvas: dados da ata');
            },
          }),
      }),
    );
    expect(erro.motivo).toBe('geracao');
    expect(erro.message).toBe(
      'Não foi possível gerar o PDF. Tente de novo; se persistir, baixe o DOCX.',
    );
  });
});
