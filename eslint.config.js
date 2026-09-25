import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/dist/**', '**/node_modules/**', '**/coverage/**', 'apps/api/drizzle/**']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts', '*.js', 'apps/*/*.{js,mjs,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/scripts/**', 'apps/api/build.mjs'],
    rules: { 'no-console': 'off' },
  },
  {
    // Layering: routes validate and delegate; only services and queries touch the database.
    files: ['apps/api/src/modules/**/*.routes.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/db/**', 'drizzle-orm', 'drizzle-orm/*'],
              message: 'Routes call services; services talk to the database.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest']],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@tabler/icons-react',
              message: 'Import icons from "@/icons" so every concept uses one registered icon.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/public/**/*.js'],
    languageOptions: { globals: globals.browser, sourceType: 'script' },
  },
  {
    files: ['apps/web/src/icons/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
]);
