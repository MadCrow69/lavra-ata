import { useState } from 'react';
import {
  camposFaltando,
  ehObrigatorio,
  ehVisivel,
  mensagemObrigatorio,
  rotuloDoCampo,
} from '../../ata-types/registry';
import type { AtaTypeDefinition, CampoDef } from '../../ata-types/types';
import { useDraft } from '../../domain/DraftContext';
import { Field } from '../../ui/Field';
import { marcarCampo } from './focar-campo';
import { FormBlock } from './FormBlock';
import styles from './form.module.css';

const MENSAGEM_PAUTA = 'Informe ao menos um item de pauta.';

function paraItens(texto: string): string[] {
  return texto
    .split(/\r\n|\r|\n/)
    .map((linha) => linha.trim())
    .filter((linha) => linha !== '');
}

function mesmosItens(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

interface CampoDadoProps {
  campo: CampoDef;
  dados: Record<string, string>;
  tocado: boolean;
  onChange: (valor: string) => void;
  onBlur: () => void;
}

function CampoDado({ campo, dados, tocado, onChange, onBlur }: CampoDadoProps) {
  const valor = dados[campo.id] ?? '';
  const obrigatorio = ehObrigatorio(campo, dados);
  const erro =
    tocado && obrigatorio && valor.trim() === '' ? mensagemObrigatorio(campo, dados) : undefined;

  return (
    <Field
      rotulo={rotuloDoCampo(campo, dados)}
      obrigatorio={obrigatorio}
      erro={erro}
      ajuda={campo.ajuda}
    >
      {(controle) => {
        const comuns = {
          ...controle,
          ...marcarCampo(campo.id),
          value: valor,
          onBlur,
        };
        switch (campo.tipo) {
          case 'escolha':
            return (
              <select
                {...comuns}
                onChange={(e) => {
                  onChange(e.target.value);
                }}
              >
                <option value="">Selecione…</option>
                {campo.opcoes?.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
              </select>
            );
          case 'textoLongo':
            return (
              <textarea
                {...comuns}
                onChange={(e) => {
                  onChange(e.target.value);
                }}
              />
            );
          default:
            return (
              <input
                {...comuns}
                type={campo.tipo === 'data' ? 'date' : campo.tipo === 'hora' ? 'time' : 'text'}
                onChange={(e) => {
                  onChange(e.target.value);
                }}
              />
            );
        }
      }}
    </Field>
  );
}

interface PautaCampoProps {
  pauta: string[];
  tocado: boolean;
  onChange: (itens: string[]) => void;
  onBlur: () => void;
}

/** Pauta: um item por linha. Guarda o texto cru para o Enter não ser engolido ao tirar linhas vazias. */
function PautaCampo({ pauta, tocado, onChange, onBlur }: PautaCampoProps) {
  const [texto, setTexto] = useState(() => pauta.join('\n'));

  // Rascunho trocado por fora (nova ata, exemplo): o texto passa a refletir a pauta.
  if (!mesmosItens(paraItens(texto), pauta)) {
    setTexto(pauta.join('\n'));
  }

  const erro = tocado && pauta.length === 0 ? MENSAGEM_PAUTA : undefined;
  return (
    <Field
      rotulo="Pauta"
      obrigatorio
      erro={erro}
      ajuda="Um item por linha, na ordem em que foram tratados."
    >
      {(controle) => (
        <textarea
          {...controle}
          {...marcarCampo('pauta')}
          value={texto}
          rows={4}
          onChange={(e) => {
            setTexto(e.target.value);
            onChange(paraItens(e.target.value));
          }}
          onBlur={onBlur}
        />
      )}
    </Field>
  );
}

export function DadosBlock({ tipo }: { tipo: AtaTypeDefinition }) {
  const { state, dispatch } = useDraft();
  const [tocados, setTocados] = useState<ReadonlySet<string>>(() => new Set());

  const faltando = camposFaltando(state, tipo)
    .filter((f) => f.bloco === 'dados')
    .map((f) => f.rotulo);

  const tocar = (id: string) => {
    setTocados((atual) => new Set(atual).add(id));
  };

  return (
    <FormBlock numero={2} titulo="Dados da reunião" bloco="dados" faltando={faltando}>
      <div className={styles.grade}>
        {tipo.campos
          .filter((campo) => ehVisivel(campo, state.dados))
          .map((campo) => (
            <CampoDado
              key={campo.id}
              campo={campo}
              dados={state.dados}
              tocado={tocados.has(campo.id)}
              onChange={(valor) => {
                dispatch({ type: 'definirCampo', campo: campo.id, valor });
              }}
              onBlur={() => {
                tocar(campo.id);
              }}
            />
          ))}
        <div className={styles.linhaInteira}>
          <PautaCampo
            pauta={state.pauta}
            tocado={tocados.has('pauta')}
            onChange={(itens) => {
              dispatch({ type: 'definirPauta', itens });
            }}
            onBlur={() => {
              tocar('pauta');
            }}
          />
        </div>
      </div>
    </FormBlock>
  );
}
