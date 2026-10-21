import type { AtaDraft } from '../domain/draft';
import { corporativa } from './corporativa';
import { textoLimpo } from './texto-modelo';
import type { AtaTypeDefinition, CampoDef, CampoFaltando } from './types';

/** Tipo de ata selecionado quando nada foi escolhido ainda. Fonte única do id padrão. */
export const TIPO_PADRAO_ID = corporativa.id;

export const ATA_TYPES: Record<string, AtaTypeDefinition> = {
  [corporativa.id]: corporativa,
};

/** Tipo pelo id; id desconhecido (rascunho antigo, sessão corrompida) cai no padrão. */
export function obterTipo(id: string): AtaTypeDefinition {
  return ATA_TYPES[id] ?? corporativa;
}

export function rotuloDoCampo(campo: CampoDef, dados: Record<string, string>): string {
  return campo.rotuloPor ? campo.rotuloPor(dados) : campo.rotulo;
}

export function ehObrigatorio(campo: CampoDef, dados: Record<string, string>): boolean {
  return campo.obrigatorioSe ? campo.obrigatorioSe(dados) : campo.obrigatorio;
}

export function ehVisivel(campo: CampoDef, dados: Record<string, string>): boolean {
  return campo.visivelSe ? campo.visivelSe(dados) : true;
}

/** Mensagem sob o campo obrigatório vazio. */
export function mensagemObrigatorio(campo: CampoDef, dados: Record<string, string>): string {
  return campo.erroObrigatorio ?? `Preencha o campo “${rotuloDoCampo(campo, dados)}”.`;
}

/**
 * Tudo que ainda impede a ata de sair completa, na ordem do formulário.
 * A transcrição entra aqui mesmo antes de existir a tela dela.
 */
export function camposFaltando(d: AtaDraft, tipo: AtaTypeDefinition): CampoFaltando[] {
  const faltas: CampoFaltando[] = [];

  for (const campo of tipo.campos) {
    if (!ehVisivel(campo, d.dados) || !ehObrigatorio(campo, d.dados)) continue;
    if (textoLimpo(d.dados[campo.id]) === '') {
      faltas.push({ bloco: 'dados', campo: campo.id, rotulo: rotuloDoCampo(campo, d.dados) });
    }
  }
  if (!d.pauta.some((item) => item.trim() !== '')) {
    faltas.push({ bloco: 'dados', campo: 'pauta', rotulo: 'Pauta' });
  }

  if (!d.participantes.some((p) => p.presenca === 'presente')) {
    faltas.push({
      bloco: 'participantes',
      campo: 'participantes',
      rotulo: 'Participante presente',
    });
  }
  if (d.participantes.some((p) => p.nome.trim() === '')) {
    faltas.push({ bloco: 'participantes', campo: 'nome', rotulo: 'Nome do participante' });
  }
  for (const campo of tipo.camposParticipante) {
    if (!campo.obrigatorio) continue;
    if (d.participantes.some((p) => textoLimpo(p.extras[campo.id]) === '')) {
      faltas.push({ bloco: 'participantes', campo: campo.id, rotulo: campo.rotulo });
    }
  }

  if (d.transcricao.trim() === '') {
    faltas.push({ bloco: 'transcricao', campo: 'transcricao', rotulo: 'Transcrição' });
  }
  return faltas;
}
