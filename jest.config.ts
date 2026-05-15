import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Only pick up files inside __tests__/
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],

  // Allow bcrypt + real DB calls to complete
  testTimeout: 30000,

  // Close open DB handles after all tests finish
  forceExit: true,

  // Reset mock state between tests (we don't use mocks but good hygiene)
  clearMocks: true,

  // Create inventory_db_test and deploy migrations once before any test runs
  globalSetup: '<rootDir>/jest.global-setup.js',

  // Load .env.test before any test module is imported
  setupFiles: ['<rootDir>/jest.env.js'],

  // ts-jest with isolatedModules bypasses rootDir:"./src" constraint
  // so test files in __tests__/ compile without errors
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
  },
};

export default config;
