import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { TITULO_REVISAO } from '../features/privacy/RevisaoDoEnvio';

/** O diálogo de revisão antes do envio (aberto por "Gerar ata"). */
export function dialogoRevisao(): HTMLElement {
  return screen.getByRole('dialog', { name: TITULO_REVISAO });
}

/**
 * "Gerar ata" e depois "Enviar" na revisão: o único caminho até a IA. Serve com ou sem ata gerada
 * ("Enviar para a IA" ou "Enviar e substituir a ata").
 */
export async function gerarEEnviar(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole('button', { name: /Gerar ata/ }));
  await user.click(within(dialogoRevisao()).getByRole('button', { name: /^Enviar/ }));
}
