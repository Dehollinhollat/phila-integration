import type { Config } from 'jest';

// Configuration Jest pour les tests backend Phila Intégration.
// ts-jest transpile TypeScript à la volée sans compilation préalable.
// setupFilesAfterEnv charge les mocks globaux après l'initialisation de Jest.
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.test.json',
    }],
  },
  moduleNameMapper: {
    '^../lib/prisma$': '<rootDir>/src/__tests__/__mocks__/prisma.ts',
    '^./lib/prisma$': '<rootDir>/src/__tests__/__mocks__/prisma.ts',
    '^../../lib/prisma$': '<rootDir>/src/__tests__/__mocks__/prisma.ts',
    '^\./prisma$': '<rootDir>/src/__tests__/__mocks__/prisma.ts',
  },
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/__tests__/**',
    '!src/server.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
};

export default config;
