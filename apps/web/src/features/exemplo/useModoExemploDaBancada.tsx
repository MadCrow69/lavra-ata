import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { obterTipo } from '../../ata-types/registry';
import type { LogoDoc } from '../../document/model';
import { useDraft } from '../../domain/DraftContext';
import type { AtaDraft } from '../../domain/draft';
import { temConteudo } from '../../domain/draft-reducer';
import {
  carregarExemplo,
  rascunhoDoExemplo,
  type CarregadoresExemplo,
} from '../../exemplos/carregar';
import { gravarExemploNaSessao } from '../../exemplos/sessao';
import type { Exemplo } from '../../exemplos/tipos';
import { useOperacaoIA } from '../../generation/OperacaoIA';
import { usePreferenciasStore } from '../../preferencias/PreferenciasContext';
import type { AbaId } from '../../shell/MobileTabs';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { BannerExemplo } from './BannerExemplo';
import { EscolherExemplo } from './EscolherExemplo';
import type { EstadoExemplo } from './ModoExemplo';

/** Modo exemplo ligado: o tipo, o rascunho do exemplo intacto e a logo fictícia, só em memória. */
interface ModoAtivo {
  tipoId: string;
  /**
   * O exemplo como chegou: `state === base` = nada a perder ao sair. `null` = não se sabe (recarregou
   * e o exemplo ainda não foi conferido, ou não carregou): na dúvida, sair pergunta.
   */
  base: AtaDraft | null;
  logo: LogoDoc | null;
}

export interface OpcoesModoExemploDaBancada {
  /** Tipo do exemplo que esta aba mostrava antes de recarregar (o rascunho de partida é ele). */
  exemploRecuperado: string | null;
  exemplos: CarregadoresExemplo;
  /** Rasteriza a logo fictícia do exemplo (a mesma porta da logo da pessoa). */
  processarLogo: (arquivo: File) => Promise<LogoDoc>;
  /** A bancada remonta formulário e folha, fecha os próprios avisos e vai para `aba`. */
  recomecar: (aba: AbaId) => void;
}

export interface ModoExemploDaBancada {
  /** O que formulário e folha leem (`ModoExemploProvider`). */
  valor: EstadoExemplo;
  ligado: boolean;
  /** No exemplo e sem nenhuma alteração: sair não perde nada, então não pergunta. */
  intacto: boolean;
  abrirSeletor: () => void;
  /**
   * Núcleo de "Nova ata" e de "Começar a minha", sem aviso: formulário vazio com o tipo mantido,
   * fora do modo exemplo (o tom volta ao da pessoa), na aba Editar.
   */
  reiniciar: () => void;
  /** Banner do modo (abaixo do cabeçalho), ou `null`. */
  aviso: ReactNode;
  /** Seletor de exemplo e confirmação de saída. */
  modais: ReactNode;
}

/** Mesma forma e mesmos valores, sem depender da ordem das chaves (o recuperado passou por JSON). */
function canonico(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonico);
  if (typeof v !== 'object' || v === null) return v;
  return Object.fromEntries(
    Object.entries(v)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, x]) => [k, canonico(x)]),
  );
}

function mesmoRascunho(a: AtaDraft, b: AtaDraft): boolean {
  return JSON.stringify(canonico(a)) === JSON.stringify(canonico(b));
}

/**
 * O modo exemplo da bancada: entrar (seletor), o banner, a IA parada (via `valor`), a logo
 * fictícia, a marca da sessão, recarregar no exemplo e sair ("Começar a minha", "Nova ata").
 */
export function useModoExemploDaBancada({
  exemploRecuperado,
  exemplos,
  processarLogo,
  recomecar,
}: OpcoesModoExemploDaBancada): ModoExemploDaBancada {
  const { state, dispatch } = useDraft();
  const { operacao, interromper } = useOperacaoIA();
  const { mostrar } = useToast();
  const preferencias = usePreferenciasStore();
  const [escolhendo, setEscolhendo] = useState(false);
  const [fechando, setFechando] = useState(false);
  // O rascunho da abertura: é ele que se compara ao exemplo depois de recarregar.
  const [recuperado] = useState(state);
  const [modo, setModo] = useState<ModoAtivo | null>(() =>
    exemploRecuperado === null ? null : { tipoId: exemploRecuperado, base: null, logo: null },
  );
  /** Cresce a cada entrada e saída do modo: a logo de um exemplo que chega tarde não cai em outro. */
  const logoRef = useRef(0);

  /** Logo fictícia do exemplo, rasterizada pela mesma porta da logo da pessoa. Falha = sem logo. */
  const prepararLogo = useCallback(
    (exemplo: Exemplo) => {
      const vez = ++logoRef.current;
      const arquivo = new File([exemplo.logoSvg], 'logo-exemplo.svg', { type: 'image/svg+xml' });
      processarLogo(arquivo)
        .then((logo) => {
          if (vez !== logoRef.current) return;
          setModo((m) => (m?.tipoId === exemplo.tipoId ? { ...m, logo } : m));
        })
        .catch(() => {
          // A logo é enfeite do exemplo: sem ela, a folha segue sem logo e sem mensagem.
        });
    },
    [processarLogo],
  );

  // Recarregou no modo exemplo: o exemplo vem de novo do próprio site (o chunk; nenhum provedor de
  // IA) para refazer a logo, que vive só na memória, e para saber se o rascunho recuperado ainda é
  // o exemplo intacto. Editado antes do F5, ou sem o exemplo para comparar, sair pergunta.
  useEffect(() => {
    if (exemploRecuperado === null) return;
    let vivo = true;
    carregarExemplo(exemploRecuperado, exemplos)
      .then((exemplo) => {
        if (!vivo) return;
        if (mesmoRascunho(recuperado, rascunhoDoExemplo(exemplo))) {
          setModo((m) =>
            m?.tipoId === exemplo.tipoId && m.base === null ? { ...m, base: recuperado } : m,
          );
        }
        prepararLogo(exemplo);
      })
      .catch(() => {
        // Sem o exemplo: segue sem a logo dele e sem saber se está intacto (o rascunho já está na
        // tela).
      });
    return () => {
      vivo = false;
    };
  }, [exemploRecuperado, exemplos, prepararLogo, recuperado]);

  const reiniciar = () => {
    // Primeiro a IA: o resultado de uma chamada antiga nunca pode cair na ata nova.
    interromper();
    dispatch({ type: 'novaAta' });
    // O exemplo vem sempre em tom formal: ao sair dele, volta o tom da pessoa (só leitura).
    const tomDaPessoa = preferencias.atual().tom;
    if (modo !== null && tomDaPessoa !== undefined) {
      dispatch({ type: 'definirTom', tom: tomDaPessoa });
    }
    logoRef.current++;
    setModo(null);
    setFechando(false);
    gravarExemploNaSessao(null);
    recomecar('editar');
  };

  const comecarAMinha = () => {
    const rotulo = obterTipo(state.tipoId).rotulo;
    reiniciar();
    mostrar({
      titulo: `Exemplo fechado. O formulário está vazio para a sua ata; o tipo “${rotulo}” foi mantido.`,
    });
  };

  // Exemplo intacto: nada a perder, então "Começar a minha" não pergunta.
  const intacto = modo !== null && modo.base !== null && state === modo.base;
  const pedirComecarAMinha = () => {
    if (intacto) comecarAMinha();
    else setFechando(true);
  };

  const entrar = (exemplo: Exemplo) => {
    // Primeiro a IA: o resultado tardio de uma geração nunca pode cair no exemplo.
    interromper();
    const rascunho = rascunhoDoExemplo(exemplo);
    dispatch({ type: 'substituirRascunho', rascunho });
    setModo({ tipoId: exemplo.tipoId, base: rascunho, logo: null });
    gravarExemploNaSessao(exemplo.tipoId);
    setFechando(false);
    setEscolhendo(false);
    recomecar('documento');
    mostrar({
      titulo: `Exemplo carregado: ${obterTipo(exemplo.tipoId).rotulo}. Nada foi enviado para IA.`,
    });
    prepararLogo(exemplo);
  };

  const valor = useMemo<EstadoExemplo>(
    () => ({ tipoId: modo?.tipoId ?? null, logo: modo?.logo ?? null }),
    [modo],
  );

  const aviso =
    modo === null ? null : (
      <BannerExemplo rotulo={obterTipo(modo.tipoId).rotulo} onComecarMinha={pedirComecarAMinha} />
    );

  const modais = (
    <>
      <EscolherExemplo
        aberto={escolhendo}
        onFechar={() => {
          setEscolhendo(false);
        }}
        carregadores={exemplos}
        substituiRascunho={temConteudo(state) && !intacto}
        cancelaGeracao={operacao !== null}
        onCarregado={entrar}
      />
      <Modal
        aberto={fechando}
        titulo="Fechar o exemplo?"
        onFechar={() => {
          setFechando(false);
        }}
        acoes={
          <>
            <Button
              onClick={() => {
                setFechando(false);
              }}
            >
              Cancelar
            </Button>
            <Button variante="perigo" onClick={comecarAMinha}>
              Apagar e começar a minha
            </Button>
          </>
        }
      >
        <p>As alterações que você fez no exemplo serão apagadas.</p>
      </Modal>
    </>
  );

  return {
    valor,
    ligado: modo !== null,
    intacto,
    abrirSeletor: () => {
      setEscolhendo(true);
    },
    reiniciar,
    aviso,
    modais,
  };
}
