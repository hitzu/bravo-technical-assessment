import { axiosInstanceWithoutToken } from '../config/axiosConfig';
import type { User } from '../types/users';


export async function getUsers(): Promise<User[]> {
  const res = await axiosInstanceWithoutToken.get<User[]>('/users');
  return res.data;
}
