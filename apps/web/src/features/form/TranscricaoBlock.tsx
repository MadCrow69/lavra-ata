import { useState, type ChangeEvent } from 'react';
import { camposFaltando, transcricaoExcedeLimite } from '../../ata-types/registry';
import type { AtaTypeDefinition } from '../../ata-types/types';
import {
  LIMITE_ARQUIVO_BYTES,
  LIMITE_TRANSCRICAO,
  PERCENTUAL_ALERTA_TRANSCRICAO,
} from '../../config/limits';
import { useDraft } from '../../domain/DraftContext';
import { BotaoArquivo } from '../../ui/BotaoArquivo';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { PrivacyPreview } from '../privacy/PrivacyPreview';
import { lerVtt } from '../transcript/vtt';
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
  /** Duração do .vtt de onde o texto veio (`null` = sem duração). */
  duracaoMin: number | null;
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

  const nivel = nivelDoContador(texto);
  const excedido = nivel === 'excedido';
  const faltando = camposFaltando(state, tipo)
    .filter((f) => f.bloco === 'transcricao')
    .map((f) => f.rotulo);

  /** Sem `duracaoMin`: a duração do .vtt continua valendo (edição à mão do mesmo texto). */
  const definir = (novo: string, duracaoMin?: number | null) => {
    dispatch({
      type: 'definirTranscricao',
      texto: novo,
      ...(duracaoMin === undefined ? {} : { duracaoMin }),
    });
  };
  const atual: Conteudo = { texto, duracaoMin: state.duracaoTranscricaoMin ?? null };

  const aoDigitar = (e: ChangeEvent<HTMLTextAreaElement>) => {
    definir(e.target.value);
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
    const lido = ehVtt ? lerVtt(conteudo) : { texto: conteudo, duracaoMs: null };
    const novo = lido.texto;
    if (novo.trim() === '') {
      setErro(
        ehVtt
          ? `Não encontrei falas em “${nome}”. Confira se é uma transcrição WebVTT e envie de novo.`
          : `O arquivo “${nome}” está vazio. Escolha outro arquivo ou cole o texto no campo.`,
      );
      return;
    }

    const anterior = texto.trim() === '' ? null : atual;
    definir(novo, minutosDaDuracao(lido.duracaoMs));
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
    setStatus({ texto: 'Transcrição apagada.', anterior: atual });
    definir('');
  };

  const desfazer = () => {
    if (status?.anterior != null) definir(status.anterior.texto, status.anterior.duracaoMin);
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
