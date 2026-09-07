export default [
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly',
        localStorage: 'readonly', fetch: 'readonly', crypto: 'readonly', console: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
        atob: 'readonly', btoa: 'readonly', FormData: 'readonly', File: 'readonly', Notification: 'readonly',
        Uint8Array: 'readonly', alert: 'readonly', prompt: 'readonly', confirm: 'readonly',
        Image: 'readonly', Blob: 'readonly', URL: 'readonly', DataView: 'readonly', TextEncoder: 'readonly',
        requestAnimationFrame: 'readonly', devicePixelRatio: 'readonly', innerWidth: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { varsIgnorePattern: '^React$', args: 'none' }],
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      'no-const-assign': 'error',
      'no-self-compare': 'warn',
      'no-cond-assign': 'error',
      'no-duplicate-case': 'error',
    },
  },
]
