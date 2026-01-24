import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/$1',
    '^@factories/(.*)$': '<rootDir>/../test/factories/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/../test/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(@faker-js/faker|@jorgebodega/typeorm-factory)/)',
  ],
  // Run tests serially to avoid database deadlocks
  maxWorkers: 1,
  // Increase test timeout for database operations
  testTimeout: 10000,
};

export default config;
