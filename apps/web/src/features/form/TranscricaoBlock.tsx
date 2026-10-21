import { useRef, useState, type ChangeEvent } from 'react';
import { camposFaltando } from '../../ata-types/registry';
import type { AtaTypeDefinition } from '../../ata-types/types';
import {
  LIMITE_ARQUIVO_BYTES,
  LIMITE_TRANSCRICAO,
  PERCENTUAL_ALERTA_TRANSCRICAO,
} from '../../config/limits';
import { useDraft } from '../../domain/DraftContext';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { PrivacyPreview } from '../privacy/PrivacyPreview';
import { vttParaTexto } from '../transcript/vtt';
import { FormBlock } from './FormBlock';
import styles from './transcricao.module.css';

const NUMERO = new Intl.NumberFormat('pt-BR');
const ACEITA = '.txt,.vtt,text/plain,text/vtt';
const MB = LIMITE_ARQUIVO_BYTES / (1024 * 1024);

const MENSAGEM_EXCEDIDO = `A transcrição passou do limite de ${String(LIMITE_TRANSCRICAO / 1000)} mil caracteres. Divida a reunião ou remova trechos sem conteúdo.`;

type Nivel = 'ok' | 'atencao' | 'excedido';

function nivelDoContador(n: number): Nivel {
  if (n > LIMITE_TRANSCRICAO) return 'excedido';
  if (n * 100 >= LIMITE_TRANSCRICAO * PERCENTUAL_ALERTA_TRANSCRICAO) return 'atencao';
  return 'ok';
}

const TEXTO_DO_NIVEL: Record<Nivel, string> = {
  ok: '',
  atencao: ' · ⚠ Perto do limite',
  excedido: ' · ⚠ Acima do limite',
};

interface Status {
  texto: string;
  /** Texto que havia antes da ação, para "Desfazer". */
  anterior: string | null;
}

export function TranscricaoBlock({ tipo }: { tipo: AtaTypeDefinition }) {
  const { state, dispatch } = useDraft();
  const texto = state.transcricao;
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const nivel = nivelDoContador(texto.length);
  const excedido = nivel === 'excedido';
  const faltando = camposFaltando(state, tipo)
    .filter((f) => f.bloco === 'transcricao')
    .map((f) => f.rotulo);
  if (excedido) faltando.push('reduzir a transcrição ao limite');

  const definir = (novo: string) => {
    dispatch({ type: 'definirTranscricao', texto: novo });
  };

  const aoDigitar = (e: ChangeEvent<HTMLTextAreaElement>) => {
    definir(e.target.value);
    // Qualquer edição à mão torna o "Desfazer" e os avisos antigos obsoletos.
    setErro(null);
    setStatus(null);
  };

  const aoEscolherArquivo = async (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    // Permite escolher o mesmo arquivo de novo depois de corrigi-lo.
    e.target.value = '';
    if (!arquivo) return;
    setErro(null);
    setStatus(null);

    const nome = arquivo.name;
    const ehVtt = /\.vtt$/i.test(nome);
    if (!ehVtt && !/\.txt$/i.test(nome)) {
      setErro(
        `O arquivo “${nome}” não é .txt nem .vtt. Salve a transcrição em um desses formatos e envie de novo.`,
      );
      return;
    }
    if (arquivo.size > LIMITE_ARQUIVO_BYTES) {
      setErro(
        `O arquivo “${nome}” passa de ${String(MB)} MB. Divida a transcrição em partes menores e envie de novo.`,
      );
      return;
    }

    let conteudo: string;
    try {
      conteudo = await arquivo.text();
    } catch {
      setErro(
        `Não foi possível ler “${nome}”. Tente enviar o arquivo de novo ou cole o texto no campo.`,
      );
      return;
    }

    const novo = ehVtt ? vttParaTexto(conteudo) : conteudo;
    if (novo.trim() === '') {
      setErro(
        ehVtt
          ? `Não encontrei falas em “${nome}”. Confira se é uma transcrição WebVTT e envie de novo.`
          : `O arquivo “${nome}” está vazio. Escolha outro arquivo ou cole o texto no campo.`,
      );
      return;
    }

    const anterior = texto.trim() === '' ? null : texto;
    definir(novo);
    const partes = [
      `Arquivo “${nome}” carregado: ${NUMERO.format(novo.length)} caracteres.`,
      anterior === null ? '' : 'O texto anterior foi substituído.',
      novo.includes('�')
        ? 'Atenção: há caracteres ilegíveis, então o arquivo provavelmente não está em UTF-8. Salve-o como UTF-8 e envie de novo.'
        : '',
    ].filter(Boolean);
    setStatus({ texto: partes.join(' '), anterior });
  };

  const limpar = () => {
    setErro(null);
    setStatus({ texto: 'Transcrição apagada.', anterior: texto });
    definir('');
  };

  const desfazer = () => {
    if (status?.anterior != null) definir(status.anterior);
    setStatus(null);
  };

  return (
    <FormBlock numero={4} titulo="Transcrição" faltando={faltando}>
      <div className={styles.acoes}>
        <Button
          onClick={() => {
            arquivoRef.current?.click();
          }}
        >
          Enviar .txt ou .vtt
        </Button>
        <Button variante="perigo" disabled={texto === ''} onClick={limpar}>
          Limpar
        </Button>
        <input
          ref={arquivoRef}
          type="file"
          accept={ACEITA}
          hidden
          tabIndex={-1}
          aria-label="Arquivo de transcrição"
          onChange={(e) => {
            void aoEscolherArquivo(e);
          }}
        />
      </div>

      {erro ? (
        <p role="alert" className={styles.erro}>
          <span aria-hidden="true">⚠ </span>
          {erro}
        </p>
      ) : null}
      {status ? (
        <div role="status" className={styles.status}>
          <p className={styles.statusTexto}>{status.texto}</p>
          {status.anterior !== null ? <Button onClick={desfazer}>Desfazer</Button> : null}
        </div>
      ) : null}

      <Field
        rotulo="Transcrição da reunião"
        obrigatorio
        erro={excedido ? MENSAGEM_EXCEDIDO : undefined}
        ajuda={`Cole o texto aqui ou envie um arquivo .txt ou .vtt (até ${String(MB)} MB). Falas no formato “Nome: fala” ajudam a IA a atribuir cada decisão.`}
      >
        {(controle) => (
          <textarea
            {...controle}
            className={styles.areaTexto}
            rows={12}
            spellCheck={false}
            value={texto}
            onChange={aoDigitar}
          />
        )}
      </Field>

      <p className={styles.contador} data-nivel={nivel} data-testid="contador-transcricao">
        {`${NUMERO.format(texto.length)} de ${NUMERO.format(LIMITE_TRANSCRICAO)} caracteres${TEXTO_DO_NIVEL[nivel]}`}
      </p>

      <PrivacyPreview texto={texto} />
    </FormBlock>
  );
}
