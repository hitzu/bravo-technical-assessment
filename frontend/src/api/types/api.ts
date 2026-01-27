import type { User } from "./users";

export type UserRole = 'ADMIN' | 'AGENT';

export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export type AuthLoginResponse = {
  token: string;
  userId: string;
  tenantId: string;
  role: UserRole;
};

export type Country = {
  id: string;
  code: string;
  name: string;
};

export type ApplicationRiskResult = {
  decision: string;
  riskScore: number;
  debtToIncomeRatio: number;
};

export type CreditApplication = {
  id: string;
  tenantId: string;
  createdBy: string;
  countryId: string;
  fullName: string;
  documentId: string;
  monthlyIncome: number;
  requestedAmount: number;
  status: string;
  bankInfo?: Record<string, unknown> | null;
  riskResult?: ApplicationRiskResult | null;
  createdAt: string;
  updatedAt: string;
  user: User;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type RiskEvalJobSummary = {
  status: string;
  attempts: number;
  lastError: string | null;
};

export type DlqRiskEvaluation = CreditApplication & {
  riskEvalJob: RiskEvalJobSummary | null;
};