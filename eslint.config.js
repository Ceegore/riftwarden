import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const simulationFiles = ['src/game/sim/**/*.{ts,tsx}'];

export default tseslint.config(
  {
    ignores: ['android/**', 'ios/**', 'content/generated/**', 'dist/**', 'node_modules/**', 'public/assets/generated/**', 'tests/fixtures/negative/**', 'Phasen/**', 'backup/**', 'Meldungen/**', '.orchestration_source/**', '.orchestrator/**', 'docs/**', 'reference/**', 'tools/**', 'tests/tooling/**', '**/*.mjs', '**/*.cjs', '**/*.js', '**/*.config.*', 'vite.config.ts', 'vitest.config.ts', 'playwright.config.ts'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'Use the tokenized RichText whitelist; dangerous HTML is forbidden.' },
      ],
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
    },
  },
  {
    files: simulationFiles,
    languageOptions: { globals: { window: 'off', document: 'off' } },
    rules: {
      'no-restricted-globals': ['error', 'window', 'document'],
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['react', 'react-dom', 'react-dom/*', 'pixi.js', 'zustand', 'motion', '@capacitor/*', '@app/*', '@audio/*', '@features/*', '@platform/*', '@screens/*', '@storage/*', '@ui/*'], message: 'game/sim is pure TypeScript and may not depend on UI, renderer, state, storage or native modules.' },
        ],
      }],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the authoritative deterministic PRNG stream.' },
        { object: 'Date', property: 'now', message: 'Simulation time is integer ticks, never wall clock.' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='Date']", message: 'Simulation may not construct wall-clock Date values.' },
        { selector: "CallExpression[callee.name='setTimeout']", message: 'Simulation uses tick scheduling, not timers.' },
        { selector: "CallExpression[callee.name='setInterval']", message: 'Simulation uses tick scheduling, not timers.' },
      ],
    },
  },
  {
    files: ['src/screens/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['@capacitor/*'], message: 'Screens/features must use platform/storage adapters.' }] }],
    },
  },
);
