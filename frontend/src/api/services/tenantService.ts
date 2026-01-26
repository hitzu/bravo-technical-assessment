import type { Tenant } from '../types/api';
import { axiosInstanceWithoutToken } from '../config/axiosConfig';

export async function listTenants(): Promise<Tenant[]> {
  const res = await axiosInstanceWithoutToken.get<Tenant[]>('/tenants');
  return res.data;
}

