import type { AuthLoginResponse } from '../types/api';
import { axiosInstanceWithToken, axiosInstanceWithoutToken } from '../config/axiosConfig';

export async function login(payload: { userId: string }): Promise<AuthLoginResponse> {
  const res = await axiosInstanceWithoutToken.post<AuthLoginResponse>(
    '/auth/login',
    payload,
  );
  return res.data;
}

export async function signup(payload: {
  email: string;
  fullName: string;
  password: string;
  role?: 'ADMIN' | 'AGENT';
  tenantId?: string;
}): Promise<AuthLoginResponse> {
  const res = await axiosInstanceWithoutToken.post<AuthLoginResponse>(
    '/auth/signup',
    payload,
  );
  return res.data;
}

export async function logout(): Promise<void> {
  await axiosInstanceWithToken.post('/auth/logout');
}