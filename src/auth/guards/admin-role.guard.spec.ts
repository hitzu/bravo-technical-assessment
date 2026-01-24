import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import { AdminRoleGuard } from './admin-role.guard';

describe('AdminRoleGuard', () => {
  let guard: AdminRoleGuard;

  beforeEach(() => {
    guard = new AdminRoleGuard();
  });

  const makeContext = (request: unknown): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as unknown as ExecutionContext;

  it('allows when authUser role is ADMIN', async () => {
    // Arrange
    const ctx = makeContext({
      authUser: {
        tenantId: '5b8c2a0e-64c1-4b33-8d66-1b4d7b7bf69a',
        userId: '0d3a3e64-3af4-46c4-9e2d-56c1920fd5a9',
        role: 'ADMIN',
      },
    });

    // Act
    const allowed = await guard.canActivate(ctx);

    // Assert
    expect(allowed).toBe(true);
  });

  it('throws ForbiddenException when authUser is missing', async () => {
    // Arrange
    const ctx = makeContext({});

    // Act / Assert
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws ForbiddenException when role is not ADMIN', async () => {
    // Arrange
    const ctx = makeContext({
      authUser: {
        tenantId: '5b8c2a0e-64c1-4b33-8d66-1b4d7b7bf69a',
        userId: '0d3a3e64-3af4-46c4-9e2d-56c1920fd5a9',
        role: 'AGENT',
      },
    });

    // Act / Assert
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

