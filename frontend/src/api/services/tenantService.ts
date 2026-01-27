import type { Tenant } from '../types/tenant';
import { axiosInstanceWithoutToken } from '../config/axiosConfig';

export async function listTenants(): Promise<Tenant[]> {
  const res = await axiosInstanceWithoutToken.get<Tenant[]>('/tenants');
  return res.data;
}

