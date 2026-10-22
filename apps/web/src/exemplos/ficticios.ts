/**
 * Fonte única dos identificadores fictícios citados nas transcrições dos exemplos. Todos têm
 * dígitos verificadores válidos (o detector de dados pessoais os reconhece e a prévia de
 * privacidade tem o que mostrar), mas não pertencem a ninguém. Só os módulos de `dados/` importam
 * daqui: o `CPF_EXEMPLO` é o marcador do `check-bundle` (`MARCADORES_EXEMPLO`) que reprova o build
 * se os dados dos exemplos entrarem na carga inicial.
 */

export const CPF_EXEMPLO = '529.982.247-25';
export const CPF_EXEMPLO_2 = '111.444.777-35';
export const TELEFONE_EXEMPLO = '(11) 98888-7777';
export const CNPJ_EXEMPLO = '11.222.333/0001-81';
export const CNPJ_ALFANUMERICO_EXEMPLO = '12.ABC.345/01DE-35';
/** Domínio reservado para exemplos (RFC 2606): nunca entrega e-mail a ninguém. */
export const EMAIL_EXEMPLO = 'agenda@example.com';
