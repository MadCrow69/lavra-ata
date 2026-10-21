import { Fragment, memo, useMemo, useRef, type ReactNode } from 'react';
import { obterTipo } from '../../ata-types/registry';
import { construirDocumento, contarPreencher, dividirPreencher } from '../../document/build-model';
import type { DocBloco, Inline } from '../../document/model';
import { useDraft } from '../../domain/DraftContext';
import { PRESENCAS, ROTULO_PRESENCA, type Presenca } from '../../domain/draft';
import { CHAVE_AVISOS_GERAIS } from '../../domain/draft-reducer';
import { chavesUnicas } from './chaves';
import styles from './preview.module.css';

/** Atributo que marca cada lacuna `[PREENCHER: …]` como alvo do contador. */
const ATRIBUTO_LACUNA = 'data-preencher';

const PREFIXO_ID_SECAO = 'ata-secao-';

function plural(n: number, singular: string, pluralForma: string): string {
  return n === 1 ? singular : pluralForma;
}

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

/** Célula de presença: ícone + rótulo (nunca só cor) + o que vier depois (a justificativa). */
function CelulaPresenca({ texto }: { texto: string }) {
  const presenca = PRESENCAS.find((p) => texto.startsWith(ROTULO_PRESENCA[p]));
  if (!presenca) return <Texto texto={texto} />;
  const rotulo = ROTULO_PRESENCA[presenca];
  return (
    <span>
      <IconePresenca presenca={presenca} />
      <strong className={styles.presencaRotulo}>{rotulo}</strong>
      <Texto texto={texto.slice(rotulo.length)} />
    </span>
  );
}

function mesmaLista(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

interface LinhaProps {
  colunas: string[];
  celulas: string[];
  colunaPresenca: number | undefined;
}

/** Memoizada: com centenas de linhas, recompor o modelo não redesenha as que não mudaram. */
const Linha = memo(
  function Linha({ colunas, celulas, colunaPresenca }: LinhaProps) {
    return (
      <tr>
        {celulas.map((celula, i) => (
          <td key={colunas[i]}>
            {i === colunaPresenca ? <CelulaPresenca texto={celula} /> : <Texto texto={celula} />}
          </td>
        ))}
      </tr>
    );
  },
  (a, b) =>
    a.colunaPresenca === b.colunaPresenca &&
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
            {bloco.colunas.map((coluna) => (
              <th key={coluna} scope="col">
                {coluna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bloco.linhas.map((celulas, i) => (
            <Linha
              key={chavesLinhas[i]}
              colunas={bloco.colunas}
              celulas={celulas}
              colunaPresenca={bloco.colunaPresenca}
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

function textoDoInline(partes: Inline[]): string {
  return partes.map((p) => p.texto).join('');
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

/**
 * `rotulo` dá nome às tabelas: o do subtítulo ou da seção que as antecede.
 * Cada `secao` é um contêiner estável (`id` + `data-secao`) onde as ações por seção se apoiam.
 */
function Blocos({ blocos, rotulo }: { blocos: DocBloco[]; rotulo: string }) {
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
        const id = idDaSecao(bloco.chave);
        nos.push(
          <section
            key={chave}
            id={id}
            data-secao={bloco.chave}
            aria-labelledby={`${id}-titulo`}
            className={juntar(styles.secao, bloco.gerada ? undefined : styles.secaoPendente)}
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
export function A4Preview() {
  const { state } = useDraft();
  const tipo = obterTipo(state.tipoId);
  const modelo = useMemo(() => construirDocumento(state, tipo), [state, tipo]);
  const lacunas = useMemo(() => contarPreencher(modelo), [modelo]);
  const chavesLinhas = chavesUnicas(modelo.cabecalho.linhas);
  const folhaRef = useRef<HTMLElement>(null);
  /** Posição da última lacuna levada ao foco (o clique no botão tira o foco dela). */
  const ultimaLacunaRef = useRef(-1);
  const avisosGerais = state.resultado?.avisos[CHAVE_AVISOS_GERAIS] ?? [];

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

  return (
    <div className={styles.area}>
      {avisosGerais.length > 0 ? (
        <ul className={styles.avisosGerais}>
          {avisosGerais.map((aviso) => (
            <li key={aviso}>
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
        <header className={styles.cabecalho}>
          <div className={styles.logo}>
            {modelo.cabecalho.logo === null ? (
              <span className={styles.logoReserva}>Sua logo</span>
            ) : (
              <img src={modelo.cabecalho.logo} alt="" className={styles.logoImagem} />
            )}
          </div>
          <div className={styles.linhas}>
            {modelo.cabecalho.linhas.map((linha, i) => (
              <p key={chavesLinhas[i]} className={styles.linha}>
                <Texto texto={linha} />
              </p>
            ))}
          </div>
        </header>
        <h2 className={styles.titulo}>
          <Texto texto={modelo.titulo} />
        </h2>
        <Blocos blocos={modelo.blocos} rotulo={modelo.titulo} />
      </article>
    </div>
  );
}
