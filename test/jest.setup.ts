import { AppDataSource as TestDataSource } from '../src/config/database/data-source';

// Global flag to prevent multiple initializations across test suites
declare global {
  var __TEST_DB_INITIALIZED__: boolean | undefined;
}

// Set JWT_SECRET for tests if not already set
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests';
}

beforeAll(async () => {
  if (!global.__TEST_DB_INITIALIZED__ && !TestDataSource.isInitialized) {
    try {
      await TestDataSource.initialize();
      global.__TEST_DB_INITIALIZED__ = true;
    } catch (error) {
      // If initialization fails (e.g., deadlock), wait a bit and retry once
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('deadlock')) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (!TestDataSource.isInitialized) {
          await TestDataSource.initialize();
          global.__TEST_DB_INITIALIZED__ = true;
        }
      } else {
        throw error;
      }
    }
  }
}, 30000); // Increase timeout to 30 seconds

afterAll(async () => {
  // Only destroy if this is the last test suite
  // Note: In parallel execution, this might not be perfect, but it's better than nothing
  if (TestDataSource.isInitialized && global.__TEST_DB_INITIALIZED__) {
    try {
      await TestDataSource.destroy();
      global.__TEST_DB_INITIALIZED__ = false;
    } catch (error) {
      // Ignore errors during cleanup
      console.error('Error destroying test database:', error);
    }
  }
});

afterEach(async () => {
  // Only run cleanup if DataSource is initialized
  if (!TestDataSource.isInitialized) {
    return;
  }

  const queryRunner = TestDataSource.createQueryRunner();

  try {
    // Disable triggers to avoid foreign key constraint issues
    await queryRunner.query('SET session_replication_role = replica;');

    const entities = TestDataSource.entityMetadatas;
    for (const entity of entities) {
      const tableName = entity.tableName;

      try {
        // Delete from all tables
        await queryRunner.query(`DELETE FROM "${tableName}";`);
      } catch (error) {
        // Ignore errors if table was already deleted or doesn't exist
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          !errorMessage.includes('does not exist') &&
          !errorMessage.includes('deadlock')
        ) {
          // Only log non-expected errors
          console.error(`Error deleting from ${tableName}:`, errorMessage);
        }
      }
    }

    // Re-enable triggers
    await queryRunner.query('SET session_replication_role = DEFAULT;');
  } catch (error) {
    // Ignore errors if connection is not available
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('not Connected')) {
      console.error('Error in afterEach cleanup:', errorMessage);
    }
  } finally {
    await queryRunner.release();
  }
});
