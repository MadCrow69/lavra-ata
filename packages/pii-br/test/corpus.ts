/**
 * Frases realistas de reunião, em pt-BR, com dados FICTÍCIOS (números de teste conhecidos).
 * Misturam tipos, acentos, quebras de linha e os falsos positivos clássicos.
 */
export const CORPUS: string[] = [
  'A cliente Maria informou o CPF 529.982.247-25 durante a reunião de alinhamento.',
  'Para o cadastro, use o CNPJ 11.222.333/0001-81 e o e-mail financeiro@exemplo.com.br.',
  'O contato do fornecedor é (11) 98888-7777; ligue após as 14h30, de segunda a sexta.',
  'Enviar a correspondência ao CEP 01310-100, conforme combinado na ata anterior.',
  'O veículo da empresa, placa ABC1D23, ficará na garagem até a vistoria de 14/10/2026.',
  'PIS do colaborador: 120.55445.81-4 — conferir antes de fechar a folha de pagamento.',
  'Pagamento no cartão 4111 1111 1111 1111, em três parcelas de R$ 1.234.567,89 cada.',
  'Participantes:\n- João (joao.silva@exemplo.com)\n- Ana (ana_souza@exemplo.org)\n- Pedro (sem e-mail)',
  'Decisão: aprovar o orçamento.\n\nPendência: confirmar o CPF 111.444.777-35 com o setor jurídico.',
  'O processo 0001234-56.2026.8.26.0100 segue em andamento; nenhum dado novo foi informado.',
  'Atualizar o sistema para a versão 2.3.4 e manter a certificação ISO 9001 em dia.',
  'Treinamento da NR-5 marcado para o item 3.2 da pauta, às 14h30.',
  'CPF 52998224725 digitado sem pontuação e, depois, o CPF 111.444.777-35 com pontuação.',
  'Sócio-administrador: CNPJ 12.ABC.345/01DE-35 (novo formato alfanumérico).',
  'Ação: ligar para +55 11 98888-7777 e confirmar o endereço de cobrança no CEP 04538-132.',
  'Ata lavrada em São Paulo, às 9h, com a presença de José, Conceição e Antônio.',
  'O RG 12.345.678-9 foi apresentado, mas o documento não foi anexado ao processo.',
  'Linha 1: maria@exemplo.com\r\nLinha 2: JOSE@EXEMPLO.COM\r\nLinha 3: fim.',
  'Sem identificadores nesta frase: apenas planejamento do trimestre, metas e prazos.',
  'Placa antiga ABC-1234 e placa nova ABC1D23 foram citadas na vistoria.',
  'Nota fiscal 000123 no valor de R$ 8.750,00, emitida em 20/10/2026, sem retenção.',
  'Texto literal que parece marcador: [CPF_1] e [telefone 2] não são dados de ninguém.',
  '',
  'Tabulação\tentre\tcampos: 111.444.777-35\tmaria@exemplo.com\t(11) 98888-7777',
];
