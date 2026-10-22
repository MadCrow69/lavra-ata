import { useEffect, useId, useRef, useState } from 'react';
import { useKeys } from '../../ai/KeysContext';
import type { ProviderId } from '../../ai/types';
import { useDraft } from '../../domain/DraftContext';
import { usePreferencias } from '../../preferencias/PreferenciasContext';
import { useModoExemplo } from '../exemplo/ModoExemplo';
import { Button } from '../../ui/Button';
import { useToast } from '../../ui/Toast';
import logo from './logo.module.css';

export const AJUDA_LEMBRAR_PREFERENCIAS =
  'Guarda o tipo de ata, o tom, a cor de destaque e a ordem e os modelos dos provedores. Nunca a transcrição, os participantes, a ata ou as chaves de IA.';
export const AVISO_PREFERENCIAS_BLOQUEADAS =
  'Este navegador bloqueou o armazenamento; as preferências valem só nesta aba.';
const TOAST_LEMBRADAS = 'Preferências lembradas neste navegador.';
const TOAST_APAGADAS =
  'Preferências apagadas deste navegador. As escolhas atuais continuam valendo nesta aba.';

/** "Lembrar preferências neste navegador" e, com ele ligado, "Esquecer preferências". */
export function LembrarPreferencias() {
  const preferencias = usePreferencias();
  const keys = useKeys();
  const { state } = useDraft();
  const noExemplo = useModoExemplo().tipoId !== null;
  const { mostrar } = useToast();
  const ajudaId = useId();
  const caixaRef = useRef<HTMLInputElement>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const lembrando = preferencias.lembrar();

  // O navegador pode recusar uma gravação depois de ligado (cota cheia): o store desliga o
  // "lembrar" sozinho, e a pessoa precisa saber que o que vem agora vale só nesta aba.
  const eraLembrandoRef = useRef(lembrando);
  const porAcaoRef = useRef(false);
  useEffect(() => {
    if (eraLembrandoRef.current && !lembrando && !porAcaoRef.current) setBloqueado(true);
    eraLembrandoRef.current = lembrando;
    porAcaoRef.current = false;
  }, [lembrando]);

  const lembrar = () => {
    const modelos: Partial<Record<ProviderId, string>> = {};
    for (const c of keys.listar()) modelos[c.provedor] = c.modelo;
    preferencias.definir({
      // No modo exemplo, tipo e tom são os do exemplo, não escolhas da pessoa: ficam os que ela já
      // tinha. Ordem e modelos dos provedores (e a cor de destaque) são dela e vão.
      ...(noExemplo ? {} : { tipoId: state.tipoId, tom: state.tom }),
      ordem: keys.ordem(),
      modelos,
    });
    const { persistiu } = preferencias.definirLembrar(true);
    setBloqueado(!persistiu);
    if (persistiu) mostrar({ titulo: TOAST_LEMBRADAS });
  };

  const esquecer = (apagar: () => void) => {
    porAcaoRef.current = true;
    setBloqueado(false);
    apagar();
    mostrar({ titulo: TOAST_APAGADAS });
  };

  return (
    <fieldset className={logo.campo}>
      <legend className={logo.rotulo}>Preferências deste navegador</legend>
      <label className={logo.lembrar}>
        <input
          ref={caixaRef}
          type="checkbox"
          checked={lembrando}
          aria-describedby={ajudaId}
          onChange={(e) => {
            if (e.target.checked) lembrar();
            else
              esquecer(() => {
                preferencias.definirLembrar(false);
              });
          }}
        />
        Lembrar preferências neste navegador
      </label>
      <p id={ajudaId} className={logo.ajuda}>
        {AJUDA_LEMBRAR_PREFERENCIAS}
      </p>
      {lembrando ? (
        <div className={logo.linha}>
          <Button
            onClick={() => {
              esquecer(preferencias.esquecer);
              // O botão some junto com o "lembrar": o foco vai para a caixa, não para o <body>.
              caixaRef.current?.focus();
            }}
          >
            Esquecer preferências
          </Button>
        </div>
      ) : null}
      {bloqueado ? (
        <p role="alert" className={logo.erro}>
          <span aria-hidden="true">⚠ </span>
          {AVISO_PREFERENCIAS_BLOQUEADAS}
        </p>
      ) : null}
    </fieldset>
  );
}
