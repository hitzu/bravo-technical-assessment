import type { UserRole, UserStatus } from './api';
import type { Tenant } from './tenant';

export type User = {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  scopes: Record<string, unknown> | null;
  lastLoginAt: string | null;
  tenant: Tenant;
};