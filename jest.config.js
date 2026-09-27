/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'client',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/src/**/*.test.ts?(x)', '<rootDir>/tests/**/*.test.ts?(x)'],
    },
    {
      displayName: 'functions',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/functions/**/*.test.ts'],
      transform: {
        '\\.[jt]s$': ['babel-jest', { presets: ['babel-preset-expo'] }],
      },
    },
    {
      displayName: 'scripts',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/scripts/**/*.test.js'],
    },
  ],
};
