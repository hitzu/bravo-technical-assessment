import type { Country } from '../types/api';
import { axiosInstanceWithToken } from '../config/axiosConfig';

export async function listCountries(): Promise<Country[]> {
  const res = await axiosInstanceWithToken.get<Country[]>('/countries');
  return res.data;
}

