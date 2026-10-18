module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    // Código nuevo de FARO sin `any`; `warn` para no romper lo portado de SIAP (B1, pregunta 12).
    '@typescript-eslint/no-explicit-any': 'warn',
    'prettier/prettier': ['error', { endOfLine: 'lf' }],
    // `BaseEntity` de FARO vive en common/entities (base-desde-siap.md, regla 3).
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'typeorm',
            importNames: ['BaseEntity'],
            message:
              'Usa BaseEntity de @common/entities (base-desde-siap.md, regla 3).',
          },
        ],
      },
    ],
  },
};
