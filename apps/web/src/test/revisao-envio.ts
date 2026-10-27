import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { TITULO_REVISAO } from '../features/privacy/revisao-textos';

/**
 * O diálogo de revisão antes do envio. Assíncrono: o diálogo é carregado sob demanda na primeira
 * abertura (`RevisaoSobDemanda`).
 */
export function dialogoRevisao(): Promise<HTMLElement> {
  return screen.findByRole('dialog', { name: TITULO_REVISAO });
}

/** Na revisão aberta, "Enviar" ("Enviar para a IA" ou "Enviar e substituir a ata"). */
export async function enviarRevisao(user: UserEvent): Promise<void> {
  await user.click(within(await dialogoRevisao()).getByRole('button', { name: /^Enviar/ }));
}

/**
 * "Gerar ata" e depois "Enviar" na revisão: o único caminho até a IA. Serve com ou sem ata gerada
 * ("Enviar para a IA" ou "Enviar e substituir a ata").
 */
export async function gerarEEnviar(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole('button', { name: /Gerar ata/ }));
  await enviarRevisao(user);
}
