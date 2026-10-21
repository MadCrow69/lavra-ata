import { useRef, type ReactNode } from 'react';
import { Button, type ButtonProps } from './Button';

export interface BotaoArquivoProps {
  children: ReactNode;
  /** Valor do atributo `accept` do seletor de arquivo. */
  accept: string;
  /** Nome acessível do seletor de arquivo escondido (o que leitores de tela e testes encontram). */
  rotuloArquivo: string;
  onArquivo: (arquivo: File) => void;
  disabled?: boolean;
  variante?: ButtonProps['variante'];
}

/**
 * Botão que abre o seletor de arquivos do sistema. O `<input type="file">` fica escondido e o
 * valor é zerado a cada escolha, para a pessoa poder enviar o mesmo arquivo de novo depois de
 * corrigi-lo.
 */
export function BotaoArquivo({
  children,
  accept,
  rotuloArquivo,
  onArquivo,
  disabled = false,
  variante,
}: BotaoArquivoProps) {
  const entradaRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        {...(variante ? { variante } : {})}
        disabled={disabled}
        onClick={() => {
          entradaRef.current?.click();
        }}
      >
        {children}
      </Button>
      <input
        ref={entradaRef}
        type="file"
        accept={accept}
        hidden
        tabIndex={-1}
        aria-label={rotuloArquivo}
        disabled={disabled}
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = '';
          if (arquivo) onArquivo(arquivo);
        }}
      />
    </>
  );
}
