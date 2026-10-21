export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['pii-br', 'web', 'ci', 'docs', 'repo', 'deps']],
    // Permite pt-BR com nomes próprios (ex.: "Lavra", "CIPA", "Ltda") no assunto.
    'subject-case': [0],
  },
};
