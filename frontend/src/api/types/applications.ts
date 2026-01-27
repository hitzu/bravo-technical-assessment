export type ListApplicationsParams = {
  page: number;
  pageSize: number;
  countryId?: string;
  status?: string;
};

export type CreateApplicationBody = {
  countryId: string;
  tenantId: string;
  fullName: string;
  documentId: string;
  monthlyIncome: number;
  requestedAmount: number;
  forceRiskFailure: boolean;
};

export type CreateApplicationOptions = {
  tenantId?: string;
  forceRiskFailure?: boolean;
};