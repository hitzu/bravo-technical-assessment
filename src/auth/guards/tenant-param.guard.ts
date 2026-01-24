import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class TenantParamGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authUser = request.authUser;
    const tenantId = request.params?.tenantId as string | undefined;

    if (!authUser) {
      throw new ForbiddenException('Authentication required');
    }

    if (!tenantId) {
      throw new ForbiddenException('tenantId param missing');
    }

    if (authUser.tenantId !== tenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }

    return true;
  }
}

