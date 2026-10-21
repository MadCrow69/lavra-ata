import {
  Fragment,
  createContext,
  memo,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { LOGO_ACCEPT } from '../../config/logo';
import { obterTipo } from '../../ata-types/registry';
import type { OpcoesCadeia } from '../../ai/chain';
import {
  construirDocumento,
  contarPreencher,
  dividirPreencher,
  textoDoInline,
} from '../../document/build-model';
import type { DocBloco, Inline } from '../../document/model';
import { useDraft } from '../../domain/DraftContext';
import type { Atribuicao, Presenca } from '../../domain/draft';
import { CHAVE_AVISOS_GERAIS, CHAVE_ENCAMINHAMENTOS } from '../../domain/draft-reducer';
import { textoDeGeracao } from '../../generation/atribuicao';
import { useLogo } from '../../logo/LogoContext';
import { BotaoArquivo } from '../../ui/BotaoArquivo';
import { plural } from '../../ui/plural';
import { useToast } from '../../ui/Toast';
import { ExportBar } from '../export/ExportBar';
import { chavesUnicas } from './chaves';
import { EncaminhamentosEditor } from './EncaminhamentosEditor';
import styles from './preview.module.css';
import revisao from './revisao.module.css';
import { SectionActions } from './SectionActions';
import { SectionEditor } from './SectionEditor';
import { comSecoesVazias } from './secoes-vazias';

/** Atributo que marca cada lacuna `[PREENCHER: …]` como alvo do contador. */
const ATRIBUTO_LACUNA = 'data-preencher';

const PREFIXO_ID_SECAO = 'ata-secao-';

/** Cada seção avisa à folha quando abre ou fecha o editor (a barra de exportação avisa quem baixa). */
const EdicaoContext = createContext<(chave: string, aberta: boolean) => void>(() => undefined);

function juntar(...classes: (string | undefined)[]): string {
  return classes.filter((c) => c !== undefined).join(' ');
}

/** O que falta, extraído de `[PREENCHER: o que falta]`, para o nome acessível da lacuna. */
function oQueFalta(marcador: string): string {
  const i = marcador.indexOf(':');
  return i === -1 ? '' : marcador.slice(i + 1, -1).trim();
}

/** Trechos de um texto; a posição do trecho no texto é a chave dele. */
function Partes({ partes }: { partes: Inline[] }) {
  let inicio = 0;
  return partes.map((parte) => {
    const chave = inicio;
    inicio += parte.texto.length;
    if (parte.destaque !== 'preencher') return <Fragment key={chave}>{parte.texto}</Fragment>;
    const falta = oQueFalta(parte.texto);
    return (
      <mark
        key={chave}
        className={styles.lacuna}
        {...{ [ATRIBUTO_LACUNA]: '' }}
        role="note"
        tabIndex={0}
        aria-label={falta === '' ? 'Campo para preencher' : `Campo para preencher: ${falta}`}
      >
        {parte.texto}
      </mark>
    );
  });
}

/** Texto solto (célula, linha do cabeçalho) que também pode trazer uma lacuna. */
function Texto({ texto }: { texto: string }) {
  return <Partes partes={dividirPreencher(texto)} />;
}

function IconePresenca({ presenca }: { presenca: Presenca }) {
  const caminho: Record<Presenca, string> = {
    presente: 'M3 8.5l3.2 3.2L13 5',
    ausente: 'M4 4l8 8M12 4l-8 8',
    justificado: 'M3.5 8h9',
  };
  return (
    <svg
      className={styles.iconePresenca}
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={caminho[presenca]} />
    </svg>
  );
}

/** Célula de presença: ícone (vindo do modelo) + texto da célula; nunca só cor. */
function CelulaPresenca({ texto, presenca }: { texto: string; presenca: Presenca | undefined }) {
  return (
    <span>
      {presenca ? <IconePresenca presenca={presenca} /> : null}
      <Texto texto={texto} />
    </span>
  );
}

function mesmaLista(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

interface LinhaProps {
  /** Chave de cada coluna (`chavesUnicas` dos títulos). */
  colunas: string[];
  celulas: string[];
  colunaPresenca: number | undefined;
  presenca: Presenca | undefined;
}

/** Memoizada: com centenas de linhas, recompor o modelo não redesenha as que não mudaram. */
const Linha = memo(
  function Linha({ colunas, celulas, colunaPresenca, presenca }: LinhaProps) {
    return (
      <tr>
        {celulas.map((celula, i) => (
          <td key={colunas[i]}>
            {i === colunaPresenca ? (
              <CelulaPresenca texto={celula} presenca={presenca} />
            ) : (
              <Texto texto={celula} />
            )}
          </td>
        ))}
      </tr>
    );
  },
  (a, b) =>
    a.colunaPresenca === b.colunaPresenca &&
    a.presenca === b.presenca &&
    mesmaLista(a.colunas, b.colunas) &&
    mesmaLista(a.celulas, b.celulas),
);

function Tabela({
  bloco,
  rotulo,
}: {
  bloco: Extract<DocBloco, { tipo: 'tabela' }>;
  rotulo: string;
}) {
  const chavesLinhas = chavesUnicas(bloco.linhas.map((celulas) => celulas.join('\u001f')));
  const chavesColunas = chavesUnicas(bloco.colunas);
  const chavesLarguras = chavesUnicas((bloco.larguras ?? []).map(String));
  return (
    <div
      className={styles.tabelaRolavel}
      role="region"
      aria-label={`${rotulo}, tabela com rolagem`}
      tabIndex={0}
    >
      <table
        className={juntar(styles.tabela, bloco.colunas.length > 3 ? styles.tabelaLarga : undefined)}
        aria-label={rotulo}
      >
        {bloco.larguras ? (
          <colgroup>
            {bloco.larguras.map((largura, i) => (
              <col key={chavesLarguras[i]} style={{ width: `${String(largura)}%` }} />
            ))}
          </colgroup>
        ) : null}
        <thead>
          <tr>
            {bloco.colunas.map((coluna, i) => (
              <th key={chavesColunas[i]} scope="col">
                {coluna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bloco.linhas.map((celulas, i) => (
            <Linha
              key={chavesLinhas[i]}
              colunas={chavesColunas}
              celulas={celulas}
              colunaPresenca={bloco.colunaPresenca}
              presenca={bloco.presencas?.[i]}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function idDaSecao(chave: string): string {
  return `${PREFIXO_ID_SECAO}${chave}`;
}

/** Identifica o bloco para a chave de lista (não precisa ser único: `chavesUnicas` resolve). */
function assinaturaDoBloco(bloco: DocBloco): string {
  switch (bloco.tipo) {
    case 'titulo':
    case 'subtitulo':
    case 'aviso':
      return `${bloco.tipo}:${bloco.texto}`;
    case 'paragrafo':
      return `paragrafo:${textoDoInline(bloco.partes)}`;
    case 'lista':
      return `lista:${bloco.itens.map(textoDoInline).join('|')}`;
    case 'secao':
      return `secao:${bloco.chave}`;
    case 'tabela':
      return `tabela:${bloco.colunas.join('|')}`;
    case 'assinaturas':
      return `assinaturas:${bloco.pessoas.map((p) => p.nome).join('|')}`;
  }
}

type DocSecao = Extract<DocBloco, { tipo: 'secao' }>;

/**
 * "Gerado por Gemini · modelo" (com quem falhou antes, se houve fallback) ou "Editado por você"
 * (a edição à mão mantém a autoria, mas manda).
 */
function textoDeAtribuicao(atribuicao: Atribuicao | undefined, editada: boolean): string | null {
  if (editada) return 'Editado por você';
  return atribuicao ? textoDeGeracao(atribuicao) : null;
}

/**
 * Seção gerada pela IA: avisos de validação acima, o texto (ou o editor), e no rodapé a
 * atribuição e as ações Editar / Regerar / Ajustar. `data-secao` e `id` ficam no contêiner.
 */
function SecaoGerada({ bloco, opcoesCadeia }: { bloco: DocSecao; opcoesCadeia?: OpcoesCadeia }) {
  const { state } = useDraft();
  const { chave, titulo } = bloco;
  const id = idDaSecao(chave);
  const resultado = state.resultado;
  const avisos = resultado?.avisos[chave] ?? [];
  const chavesAvisos = chavesUnicas(avisos);
  const editada = resultado?.editadas.includes(chave) ?? false;
  // Marcador só da tela: o modelo do documento não traz seções sem conteúdo.
  const vazia = bloco.blocos.length === 0;
  const [editando, setEditando] = useState(false);
  const editarRef = useRef<HTMLButtonElement>(null);
  const estavaEditandoRef = useRef(false);
  // Conteúdo da seção quando o editor abriu. Se ele for trocado por fora (a ata inteira gerada de
  // novo), o editor fecha: salvar o texto antigo por cima do novo desfaria a geração.
  const conteudo =
    chave === CHAVE_ENCAMINHAMENTOS ? resultado?.encaminhamentos : resultado?.secoes[chave];
  const [conteudoAoAbrir, setConteudoAoAbrir] = useState<unknown>(null);
  if (editando && conteudo !== conteudoAoAbrir) {
    setEditando(false);
  }

  // Ao fechar o editor (salvar, cancelar ou troca por fora) o foco que se perdeu com ele volta ao
  // botão Editar; foco que já está em outro lugar (ex.: na barra de geração) fica onde está.
  useEffect(() => {
    if (estavaEditandoRef.current && !editando) {
      const ativo = document.activeElement;
      if (ativo === null || ativo === document.body) editarRef.current?.focus();
    }
    estavaEditandoRef.current = editando;
  }, [editando]);

  const fechar = () => {
    setEditando(false);
  };

  // O texto de um editor aberto e não salvo não está no modelo: a folha precisa saber que há um.
  const avisarEdicao = use(EdicaoContext);
  useEffect(() => {
    avisarEdicao(chave, editando);
    return () => {
      avisarEdicao(chave, false);
    };
  }, [avisarEdicao, chave, editando]);

  return (
    <section
      id={id}
      data-secao={chave}
      aria-labelledby={`${id}-titulo`}
      className={juntar(styles.secao, revisao.secaoRevisavel)}
    >
      {avisos.length > 0 ? (
        <div role="note" className={revisao.avisos} aria-label={`Avisos da seção ${titulo}`}>
          <ul>
            {avisos.map((aviso, i) => (
              <li key={chavesAvisos[i]}>
                <span aria-hidden="true">⚠ </span>
                {aviso}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <h3 id={`${id}-titulo`} className={styles.subtitulo}>
        {titulo}
      </h3>
      {editando ? (
        chave === CHAVE_ENCAMINHAMENTOS ? (
          <EncaminhamentosEditor titulo={titulo} onFechar={fechar} />
        ) : (
          <SectionEditor chave={chave} titulo={titulo} onFechar={fechar} />
        )
      ) : vazia ? (
        <p className={revisao.secaoVazia}>Seção sem conteúdo</p>
      ) : (
        <Blocos blocos={bloco.blocos} rotulo={titulo} />
      )}
      <SectionActions
        chave={chave}
        titulo={titulo}
        atribuicao={vazia ? null : textoDeAtribuicao(resultado?.atribuicao[chave], editada)}
        editada={editada}
        vazia={vazia}
        editando={editando}
        onEditar={() => {
          setConteudoAoAbrir(conteudo);
          setEditando(true);
        }}
        editarRef={editarRef}
        {...(opcoesCadeia ? { opcoesCadeia } : {})}
      />
    </section>
  );
}

/**
 * `rotulo` dá nome às tabelas: o do subtítulo ou da seção que as antecede.
 * Cada `secao` é um contêiner estável (`id` + `data-secao`) onde as ações por seção se apoiam.
 */
function Blocos({
  blocos,
  rotulo,
  opcoesCadeia,
}: {
  blocos: DocBloco[];
  rotulo: string;
  opcoesCadeia?: OpcoesCadeia;
}) {
  let rotuloAtual = rotulo;
  const chaves = chavesUnicas(blocos.map(assinaturaDoBloco));
  const nos: ReactNode[] = [];
  blocos.forEach((bloco, i) => {
    const chave = chaves[i];
    switch (bloco.tipo) {
      case 'titulo':
      case 'subtitulo':
        rotuloAtual = bloco.texto;
        nos.push(
          <h3 key={chave} className={styles.subtitulo}>
            <Texto texto={bloco.texto} />
          </h3>,
        );
        break;
      case 'paragrafo':
        nos.push(
          <p key={chave} className={styles.paragrafo}>
            <Partes partes={bloco.partes} />
          </p>,
        );
        break;
      case 'lista': {
        const chavesItens = chavesUnicas(bloco.itens.map(textoDoInline));
        nos.push(
          <ul key={chave} className={styles.lista}>
            {bloco.itens.map((item, j) => (
              <li key={chavesItens[j]}>
                <Partes partes={item} />
              </li>
            ))}
          </ul>,
        );
        break;
      }
      case 'secao': {
        if (bloco.gerada) {
          nos.push(
            <SecaoGerada key={chave} bloco={bloco} {...(opcoesCadeia ? { opcoesCadeia } : {})} />,
          );
          break;
        }
        const id = idDaSecao(bloco.chave);
        nos.push(
          <section
            key={chave}
            id={id}
            data-secao={bloco.chave}
            aria-labelledby={`${id}-titulo`}
            className={juntar(styles.secao, styles.secaoPendente)}
          >
            <h3 id={`${id}-titulo`} className={styles.subtitulo}>
              {bloco.titulo}
            </h3>
            <Blocos blocos={bloco.blocos} rotulo={bloco.titulo} />
          </section>,
        );
        break;
      }
      case 'tabela':
        nos.push(<Tabela key={chave} bloco={bloco} rotulo={rotuloAtual} />);
        break;
      case 'assinaturas': {
        const chavesPessoas = chavesUnicas(bloco.pessoas.map((p) => `${p.nome}|${p.papel}`));
        nos.push(
          <div key={chave} className={styles.assinaturas} role="group" aria-label="Assinaturas">
            {bloco.pessoas.map((pessoa, j) => (
              <div key={chavesPessoas[j]} className={styles.assinatura}>
                <span className={styles.linhaAssinatura} aria-hidden="true" />
                <span className={styles.assinaturaNome}>
                  <Texto texto={pessoa.nome} />
                </span>
                <span className={styles.assinaturaPapel}>
                  <Texto texto={pessoa.papel} />
                </span>
              </div>
            ))}
          </div>,
        );
        break;
      }
      case 'aviso':
        nos.push(
          <p key={chave} className={styles.aviso} role="note">
            <Texto texto={bloco.texto} />
          </p>,
        );
        break;
    }
  });
  return nos;
}

/**
 * Folha A4 em HTML com prévia ao vivo: reflete o rascunho a cada alteração (título, cabeçalho,
 * participantes, pauta) e, depois de gerar, as seções, os encaminhamentos, o fecho e o aviso de
 * minuta. O conteúdo vem do `DocumentModel`; aqui só se decide a tipografia.
 */
export function A4Preview({ opcoesCadeia }: { opcoesCadeia?: OpcoesCadeia } = {}) {
  const { state } = useDraft();
  const tipo = obterTipo(state.tipoId);
  const { dados, pauta, participantes, resultado } = state;
  // Só o que o documento lê: digitar na transcrição não recompõe a folha.
  const { logo, processando, erro, aviso, enviar } = useLogo();
  const { mostrar } = useToast();
  const modelo = useMemo(
    () => construirDocumento({ dados, pauta, participantes, resultado }, tipo, logo),
    [dados, pauta, participantes, resultado, tipo, logo],
  );
  // O envio feito aqui mostra o erro num aviso (toast): no celular o bloco de formulário, que também
  // mostra o erro, está em outra aba. Só avisa pelo que ESTE botão enviou.
  const enviouAquiRef = useRef(false);
  useEffect(() => {
    if (processando || !enviouAquiRef.current) return;
    enviouAquiRef.current = false;
    const mensagem = erro ?? aviso;
    if (mensagem !== null) mostrar({ titulo: mensagem });
  }, [processando, erro, aviso, mostrar]);
  const lacunas = useMemo(() => contarPreencher(modelo), [modelo]);
  // Seções sem conteúdo aparecem na tela como marcador (o modelo do documento as omite).
  const blocosDaTela = useMemo(
    () => (resultado ? comSecoesVazias(modelo.blocos, tipo) : modelo.blocos),
    [modelo, tipo, resultado],
  );
  const chavesLinhas = chavesUnicas(modelo.cabecalho.linhas);
  const folhaRef = useRef<HTMLElement>(null);
  /** Posição da última lacuna levada ao foco (o clique no botão tira o foco dela). */
  const ultimaLacunaRef = useRef(-1);
  const avisosGerais = resultado?.avisos[CHAVE_AVISOS_GERAIS] ?? [];
  const chavesAvisos = chavesUnicas(avisosGerais);

  // Chaves das seções com o editor aberto: o arquivo exportado não leva o texto ainda não salvo.
  const [secoesEditando, setSecoesEditando] = useState<ReadonlySet<string>>(() => new Set());
  const avisarEdicao = useCallback((chave: string, aberta: boolean) => {
    setSecoesEditando((atual) => {
      if (atual.has(chave) === aberta) return atual;
      const proximo = new Set(atual);
      if (aberta) proximo.add(chave);
      else proximo.delete(chave);
      return proximo;
    });
  }, []);

  /** Cada clique vai à lacuna seguinte à anterior (a primeira no começo e depois do fim). */
  function irParaLacuna() {
    const alvos = Array.from(
      folhaRef.current?.querySelectorAll<HTMLElement>(`[${ATRIBUTO_LACUNA}]`) ?? [],
    );
    const indice = (ultimaLacunaRef.current + 1) % Math.max(alvos.length, 1);
    const proximo = alvos[indice];
    if (!proximo) return;
    ultimaLacunaRef.current = indice;
    proximo.scrollIntoView({ block: 'center' });
    proximo.focus({ preventScroll: true });
  }

  /** Da barra de exportação: recomeça o ciclo, para ir sempre à PRIMEIRA lacuna. */
  function irParaPrimeiraLacuna() {
    ultimaLacunaRef.current = -1;
    irParaLacuna();
  }

  return (
    <div className={styles.area}>
      <ExportBar
        modelo={modelo}
        lacunas={lacunas}
        onIrParaLacuna={irParaPrimeiraLacuna}
        editoresAbertos={secoesEditando.size}
      />
      {avisosGerais.length > 0 ? (
        <ul className={styles.avisosGerais}>
          {avisosGerais.map((aviso, i) => (
            <li key={chavesAvisos[i]}>
              <span aria-hidden="true">⚠ </span>
              {aviso}
            </li>
          ))}
        </ul>
      ) : null}
      {lacunas > 0 ? (
        <p className={styles.barra}>
          <button type="button" className={styles.contador} onClick={irParaLacuna}>
            {`${String(lacunas)} ${plural(lacunas, 'campo', 'campos')} para preencher`}
          </button>
        </p>
      ) : null}
      <article
        ref={folhaRef}
        className={styles.folha}
        data-folha
        lang="pt-BR"
        aria-label="Prévia da ata"
      >
        {/* Timbre da folha: `div` e não `header`, para não virar um segundo marco "banner". */}
        <div className={styles.cabecalho}>
          <div
            className={juntar(
              styles.logo,
              modelo.cabecalho.logo === null ? styles.logoVazia : undefined,
            )}
          >
            {modelo.cabecalho.logo === null ? (
              <BotaoArquivo
                accept={LOGO_ACCEPT}
                rotuloArquivo="Arquivo da logo (na folha)"
                disabled={processando}
                onArquivo={(arquivo) => {
                  enviouAquiRef.current = true;
                  void enviar(arquivo);
                }}
              >
                Adicionar logo
              </BotaoArquivo>
            ) : (
              <img
                src={modelo.cabecalho.logo.dataUrl}
                alt="Logo da organização"
                className={styles.logoImagem}
              />
            )}
          </div>
          <div className={styles.linhas}>
            {modelo.cabecalho.linhas.map((linha, i) => (
              <p key={chavesLinhas[i]} className={styles.linha}>
                <Texto texto={linha} />
              </p>
            ))}
          </div>
        </div>
        <h2 className={styles.titulo}>
          <Texto texto={modelo.titulo} />
        </h2>
        <EdicaoContext value={avisarEdicao}>
          <Blocos
            blocos={blocosDaTela}
            rotulo={modelo.titulo}
            {...(opcoesCadeia ? { opcoesCadeia } : {})}
          />
        </EdicaoContext>
        {modelo.rodapeInterno === null ? null : (
          <footer className={styles.rodapeInterno}>{modelo.rodapeInterno}</footer>
        )}
      </article>
    </div>
  );
}
