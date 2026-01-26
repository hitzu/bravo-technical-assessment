import type { CreditApplication, PaginatedResponse } from '../types/api';
import { axiosInstanceWithToken } from '../config/axiosConfig';

export type ListApplicationsParams = {
  page: number;
  pageSize: number;
  countryId?: string;
  status?: string;
};

export async function listApplications(
  params: ListApplicationsParams,
): Promise<PaginatedResponse<CreditApplication>> {
  const res = await axiosInstanceWithToken.get<
    PaginatedResponse<CreditApplication>
  >('/applications', { params });
  return res.data;
}

export async function getApplicationById(
  id: string,
): Promise<CreditApplication> {
  const res = await axiosInstanceWithToken.get<CreditApplication>(
    `/applications/${id}`,
  );
  return res.data;
}

export type CreateApplicationBody = {
  countryId: string;
  fullName: string;
  documentId: string;
  monthlyIncome: number;
  requestedAmount: number;
};

export type CreateApplicationOptions = {
  tenantId?: string;
  forceRiskFailure?: boolean;
};

export async function createApplication(
  body: CreateApplicationBody,
): Promise<CreditApplication> {

  const res = await axiosInstanceWithToken.post<CreditApplication>(
    '/applications',
    body,
  );
  return res.data;
}

