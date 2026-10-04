import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'

/** Packages that only the Electron main process may load. */
const FORBIDDEN_RUNTIME_PACKAGES = [
  { name: 'electron', message: 'Electron belongs to src/main and src/preload only.' },
  { name: 'better-sqlite3', message: 'SQLite belongs to src/main only.' }
]

/** Relative or aliased imports that land inside another process's source tree. */
const PROCESS_SOURCE_PATTERN = (dir) => ({
  group: [`**/${dir}/**`, ...(dir === 'renderer' ? ['@/*', '@renderer/*'] : [])],
  message: `Do not import src/${dir} from here — it crosses an architecture seam.`
})

const WINDOW_API_MESSAGE =
  'Call window.api only from src/renderer/src/queries/ so query keys and cache invalidation stay in one place.'

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out', 'archive/**', 'eslint.config.mjs'] },
  tseslint.configs.recommended,
  eslintPluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{ts,mts,tsx,vue}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        extraFileExtensions: ['.vue'],
        parser: tseslint.parser,
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    files: ['**/*.{ts,mts,tsx,vue}'],
    rules: {
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/block-lang': [
        'error',
        {
          script: {
            lang: 'ts'
          }
        }
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' }
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }]
    }
  },
  {
    files: ['tests/**/*.{ts,mts}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },

  // ── Architecture seams (enforced, not described) ─────────────────────────
  //
  // src/domain  — pure rules + types. No Electron, no SQLite, no UI, no IPC.
  // src/shared  — types + pure builders used by both processes. Same purity,
  //               but it may import domain.
  // src/main    — Electron main. Must not reach into renderer source.
  // src/renderer — Vue. Talks to main only through the typed `window.api`
  //               bridge, and only from src/renderer/src/queries/.
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...FORBIDDEN_RUNTIME_PACKAGES],
          patterns: [
            PROCESS_SOURCE_PATTERN('main'),
            PROCESS_SOURCE_PATTERN('preload'),
            PROCESS_SOURCE_PATTERN('renderer'),
            {
              group: ['**/shared/**', '@shared/*'],
              message:
                'src/domain is the innermost ring; src/shared depends on it, not the reverse.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...FORBIDDEN_RUNTIME_PACKAGES],
          patterns: [
            PROCESS_SOURCE_PATTERN('main'),
            PROCESS_SOURCE_PATTERN('preload'),
            PROCESS_SOURCE_PATTERN('renderer')
          ]
        }
      ]
    }
  },
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [PROCESS_SOURCE_PATTERN('renderer')] }]
    }
  },
  {
    files: ['src/renderer/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'electron', message: 'The renderer reaches main only via window.api.' },
            { name: 'better-sqlite3', message: 'SQLite lives in the main process.' }
          ],
          patterns: [PROCESS_SOURCE_PATTERN('main'), PROCESS_SOURCE_PATTERN('preload')]
        }
      ]
    }
  },
  {
    files: ['src/renderer/**/*.{ts,vue}'],
    ignores: ['src/renderer/src/queries/**'],
    rules: {
      // `window.api` is the IPC bridge. Keeping every call in queries/ gives one
      // place for query keys and cache invalidation, and one grep for the IPC
      // surface. Need a one-shot read? Add a fetch* helper next to its query.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[object.name="window"][property.name="api"]',
          message: WINDOW_API_MESSAGE
        },
        {
          selector: 'MemberExpression[object.name="window"][property.value="api"]',
          message: WINDOW_API_MESSAGE
        },
        {
          selector:
            'VariableDeclarator[init.name="window"] > ObjectPattern > Property[key.name="api"]',
          message: WINDOW_API_MESSAGE
        }
      ]
    }
  },
  eslintConfigPrettier
)
