import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ErroProvedor } from '../../ai/errors';
import { useKeys } from '../../ai/KeysContext';
import { ADAPTADORES } from '../../ai/providers';
import type { ProviderAdapter, ProviderId } from '../../ai/types';
import { MODELOS, ROTULO_PROVEDOR, URL_CHAVE } from '../../config/models';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import styles from './keys.module.css';

type Adaptadores = Record<ProviderId, ProviderAdapter>;
type Direcao = 'cima' | 'baixo';

/** Valor do `<option>` que abre o campo de id livre (não é um id de modelo real). */
const OUTRO_MODELO = '__outro__';

const MSG_CHAVE_INVALIDA = 'Chave inválida: verifique se copiou a chave inteira';
const MSG_FALHA_GENERICA =
  'Não foi possível testar a chave agora. Verifique sua conexão e tente de novo.';

export interface KeysModalProps {
  aberto: boolean;
  onFechar: () => void;
  /** Substitui os adaptadores reais (testes). */
  adaptadores?: Adaptadores;
}

interface CartaoProps {
  provedor: ProviderId;
  posicao: number;
  total: number;
  adaptador: ProviderAdapter;
  onMover: (provedor: ProviderId, direcao: Direcao) => void;
  registrarSeta: (chave: string, el: HTMLButtonElement | null) => void;
}

/** Um cartão por provedor. Guarda só o que a pessoa digita; a chave "oficial" vive no KeyStore. */
function CartaoProvedor({
  provedor,
  posicao,
  total,
  adaptador,
  onMover,
  registrarSeta,
}: CartaoProps) {
  const keys = useKeys();
  const rotulo = ROTULO_PROVEDOR[provedor];
  const tituloId = useId();
  const opcoes = MODELOS[provedor].opcoes;
  const atual = keys.listar().find((c) => c.provedor === provedor);

  const [chave, setChave] = useState(atual?.chave ?? '');
  const [modo, setModo] = useState<'lista' | 'outro'>(
    atual && !opcoes.some((o) => o.id === atual.modelo) ? 'outro' : 'lista',
  );
  // Em modo "lista" é o id escolhido; em modo "outro", o que a pessoa digitou.
  const [modelo, setModelo] = useState(atual?.modelo ?? MODELOS[provedor].padrao);
  const [visivel, setVisivel] = useState(false);
  const [testando, setTestando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const testeRef = useRef<AbortController | null>(null);
  const campoChaveRef = useRef<HTMLInputElement>(null);

  // Fechar o modal (desmontar o cartão) cancela um teste em andamento.
  useEffect(
    () => () => {
      testeRef.current?.abort();
    },
    [],
  );

  const cancelarTeste = (): void => {
    testeRef.current?.abort();
    testeRef.current = null;
    setTestando(false);
  };

  const gravar = (
    novaChave: string,
    novoModelo: string,
    estado: 'nao_testada' | 'ok' | 'invalida',
  ) => {
    if (novaChave.trim() === '') keys.remover(provedor);
    else keys.definir({ provedor, chave: novaChave, modelo: novoModelo, estado });
  };

  const aoDigitarChave = (valor: string): void => {
    cancelarTeste();
    setFalha(null);
    setChave(valor);
    gravar(valor, modelo, 'nao_testada');
  };

  const aoEscolherModelo = (valor: string): void => {
    if (valor === OUTRO_MODELO) {
      setModo('outro');
      setModelo('');
      gravar(chave, '', atual?.estado ?? 'nao_testada');
      return;
    }
    setModo('lista');
    setModelo(valor);
    gravar(chave, valor, atual?.estado ?? 'nao_testada');
  };

  const aoDigitarModelo = (valor: string): void => {
    setModelo(valor);
    gravar(chave, valor, atual?.estado ?? 'nao_testada');
  };

  const apagar = (): void => {
    cancelarTeste();
    setFalha(null);
    setChave('');
    keys.remover(provedor);
    // O botão Apagar fica desabilitado; o foco vai para o campo, não para o <body>.
    campoChaveRef.current?.focus();
  };

  const testar = async (): Promise<void> => {
    const testada = chave.trim();
    if (testada === '') return;
    testeRef.current?.abort();
    const controle = new AbortController();
    testeRef.current = controle;
    setTestando(true);
    setFalha(null);
    const registrar = (estado: 'ok' | 'invalida'): void => {
      keys.definir({ provedor, chave: testada, modelo, estado });
    };
    try {
      await adaptador.testarChave({ id: provedor, chave: testada }, controle.signal);
      if (controle.signal.aborted) return;
      registrar('ok');
    } catch (e) {
      if (controle.signal.aborted) return;
      if (e instanceof ErroProvedor && e.tipo === 'cancelado') return;
      if (e instanceof ErroProvedor && e.tipo === 'chave_invalida') {
        registrar('invalida');
      } else if (e instanceof ErroProvedor) {
        // A mensagem já vem sem a chave dos adaptadores; a troca abaixo é a segunda barreira.
        setFalha(e.message.split(testada).join('[chave removida]'));
      } else {
        setFalha(MSG_FALHA_GENERICA);
      }
    } finally {
      if (testeRef.current === controle) {
        testeRef.current = null;
        setTestando(false);
      }
    }
  };

  const temChave = chave.trim() !== '';
  const primeiro = posicao === 0;
  const ultimo = posicao === total - 1;

  let estadoTexto: string | null = null;
  let estadoClasse = styles.estadoNeutro ?? '';
  if (falha) {
    estadoTexto = falha;
    estadoClasse = styles.estadoErro ?? '';
  } else if (temChave && atual?.estado === 'ok') {
    estadoTexto = 'Chave válida';
    estadoClasse = styles.estadoOk ?? '';
  } else if (temChave && atual?.estado === 'invalida') {
    estadoTexto = MSG_CHAVE_INVALIDA;
    estadoClasse = styles.estadoErro ?? '';
  }
  const icone = falha || atual?.estado === 'invalida' ? '✕' : '✓';

  const seta = (direcao: Direcao, desabilitada: boolean) => (
    <button
      type="button"
      className={styles.seta}
      aria-label={`Mover ${rotulo} para ${direcao === 'cima' ? 'cima' : 'baixo'}`}
      aria-disabled={desabilitada}
      ref={(el) => {
        registrarSeta(`${provedor}:${direcao}`, el);
      }}
      onClick={() => {
        if (!desabilitada) onMover(provedor, direcao);
      }}
    >
      <span aria-hidden="true">{direcao === 'cima' ? '↑' : '↓'}</span>
    </button>
  );

  return (
    <li>
      <section className={styles.cartao} aria-labelledby={tituloId}>
        <div className={styles.cabecalhoCartao}>
          <div className={styles.tituloCartao}>
            <h3 id={tituloId} className={styles.nomeProvedor}>
              {rotulo}
            </h3>
            <span className={styles.prioridade}>Prioridade {posicao + 1}</span>
          </div>
          <div className={styles.ordem}>
            {seta('cima', primeiro)}
            {seta('baixo', ultimo)}
          </div>
        </div>

        <Field rotulo="Chave de API">
          {(controle) => (
            <div className={styles.linhaChave}>
              <input
                {...controle}
                ref={campoChaveRef}
                type={visivel ? 'text' : 'password'}
                value={chave}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                onChange={(e) => {
                  aoDigitarChave(e.target.value);
                }}
              />
              <Button
                aria-label={`${visivel ? 'Ocultar' : 'Mostrar'} chave de ${rotulo}`}
                onClick={() => {
                  setVisivel((v) => !v);
                }}
              >
                {visivel ? 'Ocultar' : 'Mostrar'}
              </Button>
            </div>
          )}
        </Field>

        <Field rotulo="Modelo">
          {(controle) => (
            <select
              {...controle}
              value={modo === 'outro' ? OUTRO_MODELO : modelo}
              onChange={(e) => {
                aoEscolherModelo(e.target.value);
              }}
            >
              {opcoes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.rotulo}
                  {o.id === MODELOS[provedor].padrao ? ' (padrão, mais econômico)' : ''}
                </option>
              ))}
              <option value={OUTRO_MODELO}>Outro modelo…</option>
            </select>
          )}
        </Field>
        {modo === 'outro' ? (
          <Field
            rotulo="Id do modelo"
            ajuda={`Em branco, vale o padrão (${MODELOS[provedor].padrao}).`}
          >
            {(controle) => (
              <input
                {...controle}
                type="text"
                value={modelo}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="off"
                onChange={(e) => {
                  aoDigitarModelo(e.target.value);
                }}
              />
            )}
          </Field>
        ) : null}

        <div className={styles.acoesCartao}>
          {/* aria-disabled (e não disabled) durante o teste: o foco não pode cair no <body>,
              senão Esc deixa de fechar o modal. */}
          <Button
            disabled={!temChave}
            aria-disabled={testando}
            aria-label={`${testando ? 'Testando' : 'Testar'} chave de ${rotulo}`}
            onClick={() => {
              if (!testando) void testar();
            }}
          >
            {testando ? 'Testando…' : 'Testar'}
          </Button>
          <Button
            variante="perigo"
            disabled={!temChave}
            aria-label={`Apagar chave de ${rotulo}`}
            onClick={apagar}
          >
            Apagar
          </Button>
        </div>
        <p role="status" className={[styles.estado, estadoClasse].filter(Boolean).join(' ')}>
          {estadoTexto ? (
            <>
              <span aria-hidden="true">{icone} </span>
              {estadoTexto}
            </>
          ) : null}
        </p>

        <a
          className={styles.linkChave}
          href={URL_CHAVE[provedor]}
          target="_blank"
          rel="noopener noreferrer"
        >
          Onde conseguir a chave&nbsp;
          <span aria-hidden="true">↗</span>
          <span className="somente-leitor"> (abre em nova aba)</span>
        </a>
      </section>
    </li>
  );
}

/** Modal "Chaves de IA": chave, modelo e ordem de preferência de cada provedor. */
export function KeysModal({ aberto, onFechar, adaptadores = ADAPTADORES }: KeysModalProps) {
  const keys = useKeys();
  const [confirmando, setConfirmando] = useState(false);
  const [anuncio, setAnuncio] = useState('');
  // Muda ao apagar tudo: remonta os cartões para zerarem o que a pessoa digitou.
  const [geracao, setGeracao] = useState(0);
  const setasRef = useRef(new Map<string, HTMLButtonElement>());
  const focoPendenteRef = useRef<string | null>(null);

  // Depois de reordenar, o React reposiciona os cartões; devolve o foco ao mesmo botão.
  useLayoutEffect(() => {
    const alvo = focoPendenteRef.current;
    if (alvo === null) return;
    focoPendenteRef.current = null;
    setasRef.current.get(alvo)?.focus();
  }, [keys.versao]);

  const ordem = keys.ordem();

  const mover = (provedor: ProviderId, direcao: Direcao): void => {
    const nova = [...ordem];
    const de = nova.indexOf(provedor);
    const para = direcao === 'cima' ? de - 1 : de + 1;
    if (de < 0 || para < 0 || para >= nova.length) return;
    nova.splice(de, 1);
    nova.splice(para, 0, provedor);
    focoPendenteRef.current = `${provedor}:${direcao}`;
    keys.reordenar(nova);
    setAnuncio(`Nova ordem de preferência: ${nova.map((p) => ROTULO_PROVEDOR[p]).join(', ')}.`);
  };

  const registrarSeta = (chave: string, el: HTMLButtonElement | null): void => {
    if (el) setasRef.current.set(chave, el);
    else setasRef.current.delete(chave);
  };

  const apagarTudo = (): void => {
    keys.apagarTudo();
    setGeracao((g) => g + 1);
    setAnuncio('');
    setConfirmando(false);
  };

  const avisoId = useId();

  return (
    <Modal
      aberto={aberto}
      titulo="Chaves de IA"
      onFechar={onFechar}
      acoes={
        <div className={styles.rodapeAcoes}>
          <Button
            variante="perigo"
            onClick={() => {
              setConfirmando(true);
            }}
          >
            Apagar todas as chaves
          </Button>
          <Button variante="primario" onClick={onFechar}>
            Concluir
          </Button>
        </div>
      }
    >
      <p className={styles.intro}>
        Suas chaves ficam só neste navegador e vão direto para o provedor escolhido. Nenhum servidor
        do Lavra recebe nada.
      </p>
      <p className={styles.intro}>
        Se um provedor falhar, o Lavra tenta o próximo, na ordem de prioridade abaixo.
      </p>

      <ol className={styles.lista} key={geracao}>
        {ordem.map((provedor, i) => (
          <CartaoProvedor
            key={provedor}
            provedor={provedor}
            posicao={i}
            total={ordem.length}
            adaptador={adaptadores[provedor]}
            onMover={mover}
            registrarSeta={registrarSeta}
          />
        ))}
      </ol>
      <p role="status" className="somente-leitor">
        {anuncio}
      </p>

      <div className={styles.lembrar}>
        <label className={styles.rotuloLembrar}>
          <input
            type="checkbox"
            checked={keys.lembrar()}
            aria-describedby={avisoId}
            onChange={(e) => {
              keys.definirLembrar(e.target.checked);
            }}
          />
          Lembrar neste navegador
        </label>
        <p id={avisoId} className={styles.avisoLembrar}>
          A chave ficará salva neste navegador. Qualquer extensão ou pessoa com acesso a ele poderá
          lê-la. Prefira uma chave com limite de gasto.
        </p>
      </div>

      <Modal
        aberto={confirmando}
        titulo="Apagar todas as chaves?"
        onFechar={() => {
          setConfirmando(false);
        }}
        acoes={
          <>
            <Button
              onClick={() => {
                setConfirmando(false);
              }}
            >
              Cancelar
            </Button>
            <Button variante="perigo" onClick={apagarTudo}>
              Apagar tudo
            </Button>
          </>
        }
      >
        <p className={styles.confirmacao}>
          As chaves serão removidas desta página e do armazenamento do navegador. Para gerar uma
          ata, você precisará informá-las de novo.
        </p>
      </Modal>
    </Modal>
  );
}
