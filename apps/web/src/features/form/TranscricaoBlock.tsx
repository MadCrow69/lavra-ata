import { useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react';
import { camposFaltando, transcricaoExcedeLimite } from '../../ata-types/registry';
import type { AtaTypeDefinition } from '../../ata-types/types';
import {
  LIMITE_ARQUIVO_BYTES,
  LIMITE_TRANSCRICAO,
  PERCENTUAL_ALERTA_TRANSCRICAO,
} from '../../config/limits';
import { useDraft } from '../../domain/DraftContext';
import type { DadosDoVtt } from '../../domain/draft';
import { BotaoArquivo } from '../../ui/BotaoArquivo';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { PrivacyPreview } from '../privacy/PrivacyPreview';
import { lerVtt } from '../transcript/vtt';
import { pessoasQueFalaram, sugerirFalantes } from './falantes-da-transcricao';
import { minutosDaDuracao } from './fim-pela-duracao';
import { marcarCampo } from './focar-campo';
import { FormBlock } from './FormBlock';
import { SugestaoDeFalantes } from './SugestaoDeFalantes';
import { NUMERO_BLOCO } from './numero-bloco';
import styles from './transcricao.module.css';

const NUMERO = new Intl.NumberFormat('pt-BR');
const ACEITA = '.txt,.vtt,text/plain,text/vtt';
const MB = LIMITE_ARQUIVO_BYTES / (1024 * 1024);

const MENSAGEM_EXCEDIDO = `A transcrição passou do limite de ${String(LIMITE_TRANSCRICAO / 1000)} mil caracteres. Divida a reunião ou remova trechos sem conteúdo.`;

type Nivel = 'ok' | 'atencao' | 'excedido';

function nivelDoContador(texto: string): Nivel {
  if (transcricaoExcedeLimite(texto)) return 'excedido';
  if (texto.length * 100 >= LIMITE_TRANSCRICAO * PERCENTUAL_ALERTA_TRANSCRICAO) return 'atencao';
  return 'ok';
}

const TEXTO_DO_NIVEL: Record<Nivel, string> = {
  ok: '',
  atencao: ' · ⚠ Perto do limite',
  excedido: ' · ⚠ Acima do limite',
};

interface Conteudo {
  texto: string;
  /** Dados do .vtt de onde o texto veio (`null` = não veio de .vtt). */
  vtt: DadosDoVtt | null;
}

interface Status {
  texto: string;
  /** O que havia antes da ação, para "Desfazer". */
  anterior: Conteudo | null;
}

export function TranscricaoBlock({ tipo }: { tipo: AtaTypeDefinition }) {
  const { state, dispatch } = useDraft();
  const texto = state.transcricao;
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  /** A colagem em curso substitui o campo inteiro (o `change` que vem depois a lê). */
  const colagemSubstituiRef = useRef(false);

  const nivel = nivelDoContador(texto);
  const excedido = nivel === 'excedido';
  const faltando = camposFaltando(state, tipo)
    .filter((f) => f.bloco === 'transcricao')
    .map((f) => f.rotulo);

  /** Sem `vtt`: os dados do .vtt continuam valendo (edição à mão do mesmo texto). */
  const definir = (novo: string, vtt?: DadosDoVtt | null) => {
    dispatch({ type: 'definirTranscricao', texto: novo, ...(vtt === undefined ? {} : { vtt }) });
  };
  const atual: Conteudo = { texto, vtt: state.vtt ?? null };

  // Colar por cima do campo inteiro troca a transcrição: a duração e os nomes do .vtt anterior já
  // não valem. Colar num trecho é edição do mesmo texto e os mantém.
  const aoColar = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const campo = e.currentTarget;
    colagemSubstituiRef.current =
      campo.value !== '' && campo.selectionStart === 0 && campo.selectionEnd === campo.value.length;
  };

  const aoDigitar = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const substituiu = colagemSubstituiRef.current;
    colagemSubstituiRef.current = false;
    definir(e.target.value, substituiu ? null : undefined);
    // Qualquer edição à mão torna o "Desfazer" e os avisos antigos obsoletos.
    setErro(null);
    setStatus(null);
  };

  const aoEscolherArquivo = async (arquivo: File) => {
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

    // Só o .vtt tem tempos (relativos ao começo da gravação): dão a duração, nunca o início.
    const lido = ehVtt ? lerVtt(conteudo) : null;
    const novo = lido?.texto ?? conteudo;
    if (novo.trim() === '') {
      setErro(
        ehVtt
          ? `Não encontrei falas em “${nome}”. Confira se é uma transcrição WebVTT e envie de novo.`
          : `O arquivo “${nome}” está vazio. Escolha outro arquivo ou cole o texto no campo.`,
      );
      return;
    }

    const anterior = texto.trim() === '' ? null : atual;
    const duracaoMin = minutosDaDuracao(lido?.duracaoMs ?? null);
    const vtt: DadosDoVtt | null = lido
      ? { ...(duracaoMin === null ? {} : { duracaoMin }), falantes: lido.falantesDasTags }
      : null;
    definir(novo, vtt);
    const falaram = sugerirFalantes(novo, state.participantes, vtt?.falantes).falantes.length;
    const partes = [
      `Arquivo “${nome}” carregado: ${NUMERO.format(novo.length)} caracteres${
        falaram > 0 ? ` e ${pessoasQueFalaram(falaram)} — veja a sugestão abaixo.` : '.'
      }`,
      anterior === null ? '' : 'O texto anterior foi substituído.',
      novo.includes('�')
        ? 'Atenção: há caracteres ilegíveis, então o arquivo provavelmente não está em UTF-8. Salve-o como UTF-8 e envie de novo.'
        : '',
    ].filter(Boolean);
    setStatus({ texto: partes.join(' '), anterior });
  };

  const limpar = () => {
    setErro(null);
    setStatus({ texto: 'Transcrição apagada.', anterior: atual });
    definir('');
  };

  const desfazer = () => {
    if (status?.anterior != null) definir(status.anterior.texto, status.anterior.vtt);
    setStatus(null);
  };

  return (
    <FormBlock
      numero={NUMERO_BLOCO.transcricao}
      titulo="Transcrição"
      bloco="transcricao"
      faltando={faltando}
    >
      <div className={styles.acoes}>
        <BotaoArquivo
          accept={ACEITA}
          rotuloArquivo="Arquivo de transcrição"
          onArquivo={(arquivo) => {
            void aoEscolherArquivo(arquivo);
          }}
        >
          Enviar .txt ou .vtt
        </BotaoArquivo>
        <Button variante="perigo" disabled={texto === ''} onClick={limpar}>
          Limpar
        </Button>
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
            {...marcarCampo('transcricao')}
            className={styles.areaTexto}
            rows={12}
            spellCheck={false}
            value={texto}
            onPaste={aoColar}
            onChange={aoDigitar}
          />
        )}
      </Field>

      <p className={styles.contador} data-nivel={nivel} data-testid="contador-transcricao">
        {`${NUMERO.format(texto.length)} de ${NUMERO.format(LIMITE_TRANSCRICAO)} caracteres${TEXTO_DO_NIVEL[nivel]}`}
      </p>

      <SugestaoDeFalantes tipo={tipo} />

      <PrivacyPreview texto={texto} />
    </FormBlock>
  );
}
