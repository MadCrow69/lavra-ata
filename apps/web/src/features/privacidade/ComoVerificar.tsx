import { Fragment, useMemo } from 'react';
import { ORIGEM_PROVEDOR } from '../../config/models';
import {
  CAMINHOS_CODIGO,
  COMMIT_CURTO_TAMANHO,
  COMMIT_DESENVOLVIMENTO,
  SITE,
  urlDoCodigo,
  urlDoCommit,
} from '../../config/site';
import { LinkExterno } from '../../ui/LinkExterno';
import { Modal } from '../../ui/Modal';
import styles from './como-verificar.module.css';

export const TITULO_COMO_VERIFICAR = 'Privacidade: como verificar';
/** Nome do corpo rolável do diálogo (o texto é longo e rola pelo teclado). */
export const ROTULO_CORPO_COMO_VERIFICAR = 'Texto de Privacidade: como verificar';
/** Só quando a página não tem o `<meta>` de CSP: no servidor de desenvolvimento ele não é inserido. */
export const AVISO_SEM_META_CSP =
  'Nesta página a tag não existe porque o servidor de desenvolvimento não a insere; ela vem no build, como no site publicado.';

/** A página atual tem o `<meta>` de CSP? (Build local ou publicado: sim; `pnpm dev`: não.) */
function temMetaDeCsp(): boolean {
  return document.querySelector('meta[http-equiv="Content-Security-Policy" i]') !== null;
}

export interface ComoVerificarModalProps {
  aberto: boolean;
  onFechar: () => void;
  /** SHA completo do commit publicado; 'dev' fora do build do CI. */
  commit?: string;
}

/** Hosts (sem esquema) das APIs permitidas, na ordem de `ORIGEM_PROVEDOR`. */
const HOSTS = Object.values(ORIGEM_PROVEDOR).map((origem) => new URL(origem).host);

/** "a, b ou c": cada host em `<code>`, ligados por vírgula e "ou". */
function HostsUnidos() {
  return (
    <>
      {HOSTS.map((host, i) => (
        <Fragment key={host}>
          {i === 0 ? '' : i === HOSTS.length - 1 ? ' ou ' : ', '}
          <code>{host}</code>
        </Fragment>
      ))}
    </>
  );
}

export function ComoVerificarModal({
  aberto,
  onFechar,
  commit = SITE.commit,
}: ComoVerificarModalProps) {
  const emDesenvolvimento = commit === COMMIT_DESENVOLVIMENTO;
  // Lido do DOM uma vez a cada abertura (a tag não muda com a página aberta), fora do texto.
  const semMetaDeCsp = useMemo(() => aberto && !temMetaDeCsp(), [aberto]);

  return (
    <Modal
      aberto={aberto}
      titulo={TITULO_COMO_VERIFICAR}
      onFechar={onFechar}
      rotuloCorpo={ROTULO_CORPO_COMO_VERIFICAR}
    >
      <div className={styles.conteudo}>
        <section className={styles.secao}>
          <h3>O que sai do navegador</h3>
          <p>
            Somente as chamadas aos provedores de IA que você cadastrou, na ordem da sua lista, com
            a transcrição já mascarada e só depois de você revisar o conteúdo e clicar em “Enviar
            para a IA”. Nenhum servidor do Lavra recebe nada. Os únicos endereços permitidos são:
          </p>
          <ul>
            {HOSTS.map((host) => (
              <li key={host}>
                <code>{host}</code>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.secao}>
          <h3>Confira na aba Rede</h3>
          <ol>
            <li>
              Abra as ferramentas do desenvolvedor: <kbd>F12</kbd> ou <kbd>Ctrl+Shift+I</kbd> (no
              Mac, <kbd>Cmd+Option+I</kbd>).
            </li>
            <li>Vá à aba Rede (Network) e recarregue a página.</li>
            <li>Filtre por Fetch/XHR.</li>
            <li>
              Gere uma ata (revise e clique em “Enviar para a IA”): só aparecem chamadas a{' '}
              <HostsUnidos />, na ordem da sua lista.
            </li>
            <li>
              Abra a chamada e veja o conteúdo enviado (Payload): no lugar de CPF, telefone e e-mail
              aparecem marcadores como <code>[CPF_1]</code>.
            </li>
          </ol>
        </section>

        <section className={styles.secao}>
          <h3>Confira a política de segurança (CSP)</h3>
          <p>
            Na aba Elementos, dentro de <code>&lt;head&gt;</code>, a tag{' '}
            <code>&lt;meta http-equiv=&quot;Content-Security-Policy&quot;&gt;</code> lista os
            destinos permitidos em <code>connect-src</code>. O próprio navegador bloqueia qualquer
            outro.
            {semMetaDeCsp ? ` ${AVISO_SEM_META_CSP}` : ''}
          </p>
          <p>
            <LinkExterno href={urlDoCodigo(CAMINHOS_CODIGO.csp, commit)}>
              Definição da CSP no código
            </LinkExterno>
          </p>
        </section>

        <section className={styles.secao}>
          <h3>Confira o código desta versão</h3>
          {emDesenvolvimento ? (
            <p>Versão de desenvolvimento: os links abaixo apontam para a branch main.</p>
          ) : (
            <p>
              Este site foi publicado pelo GitHub Actions a partir do commit{' '}
              <LinkExterno href={urlDoCommit(commit)}>
                {commit.slice(0, COMMIT_CURTO_TAMANHO)}
              </LinkExterno>
              .
            </p>
          )}
          <ul>
            <li>
              <LinkExterno href={urlDoCodigo(CAMINHOS_CODIGO.adaptadores, commit)}>
                Adaptadores de IA (as chamadas aos provedores)
              </LinkExterno>
            </li>
            <li>
              <LinkExterno href={urlDoCodigo(CAMINHOS_CODIGO.piiBr, commit)}>
                Biblioteca @lavra/pii-br (detecção e máscara)
              </LinkExterno>
            </li>
            <li>
              <LinkExterno href={urlDoCodigo(CAMINHOS_CODIGO.deploy, commit)}>
                Workflow que publica o site
              </LinkExterno>
            </li>
          </ul>
          <p>
            O site publicado fica em <code>{SITE.demo}</code>.
          </p>
        </section>

        <section className={styles.secao}>
          <h3>O que não é protegido</h3>
          <ul>
            <li>Nomes de pessoas não são mascarados — a ata precisa deles.</li>
            <li>
              Informação sensível escrita em linguagem natural (um diagnóstico, um endereço, uma
              opinião) vai como está. O app avisa quando acha termos de uma lista (saúde, conflito
              trabalhista, filiação sindical, política ou religiosa, origem racial ou étnica, vida
              sexual, biometria), mas é um aviso por lista de palavras, não uma proteção: o que for
              dito de outro jeito passa sem aviso.
            </li>
            <li>
              Regerar ou ajustar uma seção não abre a revisão: reenvia a transcrição já revisada
              (mascarada), o texto atual da seção e a instrução que você digitar (também
              mascarados).
            </li>
            <li>O que é enviado fica sob os termos do provedor que você escolheu.</li>
            <li>Uma extensão do navegador com acesso à página pode ler a chave e o texto.</li>
            <li>
              O modo exemplo não envia nada para IA: o exemplo já vem pronto no site. Só o “Testar”
              do modal de chaves, se você clicar nele, fala com o provedor, para conferir a sua
              chave, sem nada do exemplo.
            </li>
          </ul>
        </section>
      </div>
    </Modal>
  );
}
