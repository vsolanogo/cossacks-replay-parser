import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'build', 'coverage']),
  
  // The base ESLint recommended rules for modern JS.
  // This line uses the 'js' import.
  js.configs.recommended, 
  
  // Global settings that apply to all files
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  
  // JavaScript/JSX configuration
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.recommended.rules,
      'no-unused-vars': ['error', { 
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^_'
      }],
      // Common exceptions that developers appreciate
      'no-console': 'warn', // Warn instead of error
      'no-debugger': 'warn', // Warn instead of error
    },
  },
  
  // TypeScript/TSX configuration
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.recommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { 
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^_'
      }],
      // Common TypeScript exceptions
      '@typescript-eslint/no-explicit-any': 'warn', // Warn instead of error
      '@typescript-eslint/explicit-function-return-type': 'off', // Allow inference
      '@typescript-eslint/explicit-module-boundary-types': 'off', // Allow inference
      '@typescript-eslint/no-non-null-assertion': 'warn', // Warn instead of error
      // Common exceptions that developers appreciate
      'no-console': 'warn',
      'no-debugger': 'warn',
    },
  },
])