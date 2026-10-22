import { createContext, use, type ReactNode } from 'react';
import type { LogoDoc } from '../../document/model';

/**
 * Motivo de todo botão de IA parado no modo exemplo (Gerar, Regerar, Ajustar, "Tentar de novo").
 * Exceção deliberada: o "Testar" do modal de chaves segue livre — é a pessoa conferindo a própria
 * chave (só a chave vai ao provedor, nada do exemplo); a página "Privacidade: como verificar" diz
 * isso.
 */
export const MOTIVO_EXEMPLO =
  'No exemplo, nada é enviado para IA. Para gerar com a sua chave, clique em “Começar a minha”.';

/**
 * Motivo dos rádios de tipo parados no modo exemplo: trocar o tipo ali deixaria a marca da sessão
 * diferente do tipo do rascunho (ruling B2).
 */
export const MOTIVO_TIPO_NO_EXEMPLO =
  'Para ver outro tipo, use “Ver exemplo”; para a sua ata, “Começar a minha”.';

/**
 * Modo exemplo da bancada: `tipoId` do exemplo carregado (`null` = fora do modo) e a logo fictícia
 * do exemplo, só em memória (nunca no `LogoStore` da pessoa).
 */
export interface EstadoExemplo {
  tipoId: string | null;
  logo: LogoDoc | null;
}

const FORA_DO_EXEMPLO: EstadoExemplo = { tipoId: null, logo: null };

const ModoExemploContext = createContext<EstadoExemplo>(FORA_DO_EXEMPLO);

/** O estado vive na bancada; aqui só chega a formulário e folha. */
export function ModoExemploProvider({
  valor,
  children,
}: {
  valor: EstadoExemplo;
  children: ReactNode;
}) {
  return <ModoExemploContext value={valor}>{children}</ModoExemploContext>;
}

/** Fora do provider: fora do modo exemplo. */
export function useModoExemplo(): EstadoExemplo {
  return use(ModoExemploContext);
}
