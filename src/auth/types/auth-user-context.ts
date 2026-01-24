export type AuthUserRole = 'ADMIN' | 'AGENT';

export interface AuthUserContext {
  tenantId: string;
  userId: string;
  role: AuthUserRole;
}

