import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import { TenantParamGuard } from './tenant-param.guard';

describe('TenantParamGuard', () => {
  let guard: TenantParamGuard;

  beforeEach(() => {
    guard = new TenantParamGuard();
  });

  const makeContext = (request: unknown): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as unknown as ExecutionContext;

  it('allows when tenantId param matches authUser tenantId', async () => {
    // Arrange
    const ctx = makeContext({
      authUser: {
        tenantId: '5b8c2a0e-64c1-4b33-8d66-1b4d7b7bf69a',
        userId: '0d3a3e64-3af4-46c4-9e2d-56c1920fd5a9',
        role: 'ADMIN',
      },
      params: { tenantId: '5b8c2a0e-64c1-4b33-8d66-1b4d7b7bf69a' },
    });

    // Act
    const allowed = await guard.canActivate(ctx);

    // Assert
    expect(allowed).toBe(true);
  });

  it('throws ForbiddenException when authUser is missing', async () => {
    // Arrange
    const ctx = makeContext({ params: { tenantId: '1' } });

    // Act / Assert
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws ForbiddenException when tenantId param is missing', async () => {
    // Arrange
    const ctx = makeContext({
      authUser: {
        tenantId: '5b8c2a0e-64c1-4b33-8d66-1b4d7b7bf69a',
        userId: '0d3a3e64-3af4-46c4-9e2d-56c1920fd5a9',
        role: 'ADMIN',
      },
      params: {},
    });

    // Act / Assert
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws ForbiddenException when tenantId param mismatches authUser tenantId', async () => {
    // Arrange
    const ctx = makeContext({
      authUser: {
        tenantId: '5b8c2a0e-64c1-4b33-8d66-1b4d7b7bf69a',
        userId: '0d3a3e64-3af4-46c4-9e2d-56c1920fd5a9',
        role: 'ADMIN',
      },
      params: { tenantId: 'fb399e03-66ff-4f1c-9f0d-3a256c2d1f0f' },
    });

    // Act / Assert
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

