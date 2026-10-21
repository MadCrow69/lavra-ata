import { cartao } from './cartao';
import { cep } from './cep';
import { cnpj } from './cnpj';
import { cpf } from './cpf';
import { email } from './email';
import { pis } from './pis';
import { placa } from './placa';
import { rg } from './rg';
import { telefone } from './telefone';
import type { Detector } from './types';

/**
 * Detectores em ORDEM DE PRECEDÊNCIA: em sobreposição, o primeiro vence. E-mail antes
 * de tudo (pode conter dígitos); documentos com DV antes dos padrões soltos;
 * RG por último (só com contexto, o mais frouxo).
 */
export const DETECTORS: readonly Detector[] = [
  email,
  cnpj,
  cpf,
  pis,
  cartao,
  telefone,
  cep,
  placa,
  rg,
];
