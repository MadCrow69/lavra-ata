import { useId } from 'react';
import { LOGO_ACCEPT } from '../../config/logo';
import { useLogo } from '../../logo/LogoContext';
import { LOGO_TAMANHO_MAX_MB_TEXTO } from '../../logo/validar-logo';
import { BotaoArquivo } from '../../ui/BotaoArquivo';
import { Button } from '../../ui/Button';
import styles from './logo.module.css';

const AJUDA = `PNG, JPEG, WebP ou SVG até ${LOGO_TAMANHO_MAX_MB_TEXTO} MB. A logo fica neste navegador e nunca vai para a IA.`;

/**
 * Logo da organização (opcional): vai só para o cabeçalho da folha e dos arquivos exportados.
 * O estado vive no `LogoProvider`, fora do rascunho: "Nova ata" não a apaga.
 */
export function LogoField() {
  const { logo, lembrar, processando, erro, aviso, enviar, remover, definirLembrar } = useLogo();
  const ajudaId = useId();

  return (
    <fieldset className={styles.campo} aria-describedby={ajudaId}>
      <legend className={styles.rotulo}>Logo da organização (opcional)</legend>

      {logo === null ? (
        <div className={styles.linha}>
          <BotaoArquivo
            accept={LOGO_ACCEPT}
            rotuloArquivo="Arquivo da logo"
            disabled={processando}
            onArquivo={(arquivo) => {
              void enviar(arquivo);
            }}
          >
            Enviar logo
          </BotaoArquivo>
        </div>
      ) : (
        <>
          <div className={styles.linha}>
            <img src={logo.dataUrl} alt="Logo da organização" className={styles.miniatura} />
            <BotaoArquivo
              accept={LOGO_ACCEPT}
              rotuloArquivo="Arquivo da nova logo"
              disabled={processando}
              onArquivo={(arquivo) => {
                void enviar(arquivo);
              }}
            >
              Trocar logo
            </BotaoArquivo>
            <Button variante="perigo" onClick={remover}>
              Remover logo
            </Button>
          </div>
          <label className={styles.lembrar}>
            <input
              type="checkbox"
              checked={lembrar}
              onChange={(e) => {
                definirLembrar(e.target.checked);
              }}
            />
            Lembrar logo neste navegador
          </label>
        </>
      )}

      <p id={ajudaId} className={styles.ajuda}>
        {AJUDA}
      </p>
      {/* A região existe antes do texto, para o leitor de tela anunciar quando ele aparecer. */}
      <div aria-live="polite">
        {processando ? <p className={styles.processando}>Processando a logo…</p> : null}
      </div>
      {erro ? (
        <p role="alert" className={styles.erro}>
          <span aria-hidden="true">⚠ </span>
          {erro}
        </p>
      ) : null}
      {aviso ? (
        <p role="status" className={styles.aviso}>
          <span aria-hidden="true">⚠ </span>
          {aviso}
        </p>
      ) : null}
    </fieldset>
  );
}
