import { useEffect, useId, useRef, useState } from 'react';
import { ErroProvedor, mensagemSemCredito } from '../../ai/errors';
import { useKeys } from '../../ai/KeysContext';
import type { ProviderAdapter, ProviderId } from '../../ai/types';
import { MODELOS, ROTULO_PROVEDOR, URL_CHAVE, erroDoIdDeModeloComChave } from '../../config/models';
import { usePreferenciasStore } from '../../preferencias/PreferenciasContext';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import styles from './keys.module.css';

export type Direcao = 'cima' | 'baixo';

/** Valor do `<option>` que abre o campo de id livre (não é um id de modelo real). */
const OUTRO_MODELO = '__outro__';

const MSG_CHAVE_INVALIDA = 'Chave inválida: verifique se copiou a chave inteira';
const MSG_FALHA_GENERICA =
  'Não foi possível testar a chave agora. Verifique sua conexão e tente de novo.';

export interface CartaoProps {
  provedor: ProviderId;
  posicao: number;
  total: number;
  adaptador: ProviderAdapter;
  onMover: (provedor: ProviderId, direcao: Direcao) => void;
  registrarSeta: (chave: string, el: HTMLButtonElement | null) => void;
}

/** Um cartão por provedor. Guarda só o que a pessoa digita; a chave "oficial" vive no KeyStore. */
export function CartaoProvedor({
  provedor,
  posicao,
  total,
  adaptador,
  onMover,
  registrarSeta,
}: CartaoProps) {
  const keys = useKeys();
  const preferencias = usePreferenciasStore();
  const rotulo = ROTULO_PROVEDOR[provedor];
  const tituloId = useId();
  const opcoes = MODELOS[provedor].opcoes;
  const atual = keys.listar().find((c) => c.provedor === provedor);

  const [chave, setChave] = useState(atual?.chave ?? '');
  // Modelo de partida: o da chave guardada, senão o lembrado nas preferências, senão o padrão.
  const [modeloInicial] = useState(
    () => atual?.modelo ?? preferencias.atual().modelos?.[provedor] ?? MODELOS[provedor].padrao,
  );
  const [modo, setModo] = useState<'lista' | 'outro'>(
    opcoes.some((o) => o.id === modeloInicial) ? 'lista' : 'outro',
  );
  // Em modo "lista" é o id escolhido; em modo "outro", o que a pessoa digitou.
  const [modelo, setModelo] = useState(modeloInicial);
  // Id digitado que não pode ser usado: a causa e o que fazer (nada é gravado enquanto durar).
  const [erroModelo, setErroModelo] = useState<string | null>(null);
  // O único modelo que pode ir para o KeyStore e para as preferências: o último id VÁLIDO
  // ('' = o padrão). O que está no campo pode ser inválido e nunca é gravado.
  const [modeloGravado, setModeloGravado] = useState(modeloInicial);
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
    semCredito = false,
  ) => {
    if (novaChave.trim() === '') keys.remover(provedor);
    else keys.definir({ provedor, chave: novaChave, modelo: novoModelo, estado, semCredito });
  };

  const aoDigitarChave = (valor: string): void => {
    cancelarTeste();
    setFalha(null);
    setChave(valor);
    // A chave nova pode passar a aparecer no id digitado (campo ou o já gravado): reavalia.
    if (modo === 'outro') setErroModelo(erroDoIdDeModeloComChave(modelo, valor));
    let seguro = modeloGravado;
    if (erroDoIdDeModeloComChave(seguro, valor) !== null) {
      seguro = '';
      setModeloGravado('');
      preferencias.definir({ modelos: { [provedor]: '' } });
    }
    gravar(valor, seguro, 'nao_testada');
  };

  const aoEscolherModelo = (valor: string): void => {
    setErroModelo(null);
    if (valor === OUTRO_MODELO) {
      setModo('outro');
      setModelo('');
      setModeloGravado('');
      gravar(chave, '', atual?.estado ?? 'nao_testada', atual?.semCredito);
      // O campo nasce vazio (= o padrão): o modelo lembrado sai junto, como ao apagar o campo.
      preferencias.definir({ modelos: { [provedor]: '' } });
      return;
    }
    setModo('lista');
    setModelo(valor);
    setModeloGravado(valor);
    gravar(chave, valor, atual?.estado ?? 'nao_testada', atual?.semCredito);
    preferencias.definir({ modelos: { [provedor]: valor } });
  };

  const aoDigitarModelo = (valor: string): void => {
    setModelo(valor);
    // Uma chave colada aqui por engano não pode ir para o KeyStore (que pode estar lembrado no
    // navegador) nem para as preferências: enquanto o id for inválido, vale o modelo anterior.
    const erro = erroDoIdDeModeloComChave(valor, chave);
    setErroModelo(erro);
    if (erro !== null) return;
    setModeloGravado(valor);
    gravar(chave, valor, atual?.estado ?? 'nao_testada', atual?.semCredito);
    // Em branco apaga o modelo lembrado (volta o padrão); o store ignora o que não é um id.
    preferencias.definir({ modelos: { [provedor]: valor } });
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
    const registrar = (estado: 'ok' | 'invalida', semCredito = false): void => {
      // Só o veredito: o modelo pode ter mudado enquanto o teste rodava.
      keys.definirEstado(provedor, testada, estado, semCredito);
    };
    try {
      await adaptador.testarChave({ id: provedor, chave: testada }, controle.signal);
      if (controle.signal.aborted) return;
      registrar('ok');
    } catch (e) {
      if (controle.signal.aborted) return;
      if (e instanceof ErroProvedor && e.tipo === 'cancelado') return;
      if (e instanceof ErroProvedor && e.tipo === 'chave_invalida') {
        registrar('invalida', e.semCredito);
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
    estadoTexto = atual.semCredito === true ? mensagemSemCredito(provedor) : MSG_CHAVE_INVALIDA;
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
            erro={erroModelo ?? undefined}
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
