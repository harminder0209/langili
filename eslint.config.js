// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // eslint-plugin-react 7.37 can't auto-detect the React version under ESLint 10
    // (it calls the removed context.getFilename), so the version is stated here.
    settings: { react: { version: '19.2' } },
  },
  {
    ignores: [
      'dist/*',
      'functions/types.d.ts',
      'functions/build-info.ts',
      'playwright-report/*',
      'test-results/*',
    ],
  },
]);
