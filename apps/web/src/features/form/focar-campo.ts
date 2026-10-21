import type { CampoFaltando } from '../../ata-types/types';

/**
 * Leva o foco ao campo apontado por `camposFaltando` (resumo "Falta: …" da barra de geração).
 *
 * Contrato com a tela: cada controle do formulário carrega `data-campo="<id do CampoFaltando>"`
 * (ex.: `data`, `pauta`, `participantes`, `nome`, `transcricao`); cada bloco recolhível, o
 * conteúdo com `data-bloco-conteudo` e a seção com `data-bloco="<bloco>"`. Com vários controles
 * para o mesmo campo (nome de cada participante), vale o primeiro com `aria-invalid="true"`.
 */

/** Atributo que liga o controle ao `campo` de `CampoFaltando`. */
const ATRIBUTO_CAMPO = 'data-campo';

/** Props que marcam um controle como o campo `campo` (espalhar no input/select/textarea). */
export function marcarCampo(campo: string): { [ATRIBUTO_CAMPO]: string } {
  return { [ATRIBUTO_CAMPO]: campo };
}

/**
 * Evento disparado no conteúdo de um bloco recolhido: o FormBlock se abre e, depois de abrir,
 * foca `detail.alvo` (o controle só fica focável quando o bloco já está visível).
 */
export const EVENTO_REVELAR = 'lavra:revelar-bloco';

export interface DetalheRevelar {
  alvo: HTMLElement;
}

function controleDo(campo: string, raiz: ParentNode): HTMLElement | null {
  // Compara o atributo em vez de montar seletor com o id: nada a escapar.
  const candidatos = Array.from(raiz.querySelectorAll<HTMLElement>(`[${ATRIBUTO_CAMPO}]`)).filter(
    (el) => el.getAttribute(ATRIBUTO_CAMPO) === campo,
  );
  return (
    candidatos.find((el) => el.getAttribute('aria-invalid') === 'true') ?? candidatos[0] ?? null
  );
}

function cabecalhoDoBloco(bloco: string, raiz: ParentNode): HTMLElement | null {
  const secao = Array.from(raiz.querySelectorAll<HTMLElement>('[data-bloco]')).find(
    (el) => el.dataset.bloco === bloco,
  );
  return secao?.querySelector<HTMLElement>('button[aria-expanded]') ?? null;
}

/**
 * Foca o controle do campo; se ele está num bloco recolhido, abre o bloco antes. Sem controle
 * visível (ex.: linha escondida pela busca), foca o cabeçalho do bloco. Devolve se focou algo.
 */
export function focarCampo(falta: CampoFaltando, raiz: ParentNode = document): boolean {
  const controle = controleDo(falta.campo, raiz);
  if (controle) {
    const conteudo = controle.closest<HTMLElement>('[data-bloco-conteudo]');
    if (conteudo?.hidden) {
      conteudo.dispatchEvent(
        new CustomEvent<DetalheRevelar>(EVENTO_REVELAR, { detail: { alvo: controle } }),
      );
      return true;
    }
    controle.focus();
    if (controle.ownerDocument.activeElement === controle) return true;
  }
  const cabecalho = cabecalhoDoBloco(falta.bloco, raiz);
  cabecalho?.focus();
  return cabecalho !== null && cabecalho.ownerDocument.activeElement === cabecalho;
}
