import type { CreditApplication, PaginatedResponse } from '../types/api';
import { axiosInstanceWithToken } from '../config/axiosConfig';
import type { CreateApplicationBody, ListApplicationsParams } from '../types';



export async function listApplications(
  params: ListApplicationsParams,
): Promise<PaginatedResponse<CreditApplication>> {
  const res = await axiosInstanceWithToken.get<
    PaginatedResponse<CreditApplication>
  >('/applications', {
    params,
    // Avoid browser caching turning into 304 (Axios treats 304 as error)
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
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

export async function createApplication(
  body: CreateApplicationBody,
): Promise<CreditApplication> {

  const res = await axiosInstanceWithToken.post<CreditApplication>(
    '/applications',
    body,
  );
  return res.data;
}

