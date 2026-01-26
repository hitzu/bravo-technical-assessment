import axios from 'axios';

import type { AsyncJob } from '../types/api';
import { axiosInstanceWithToken } from '../config/axiosConfig';

export async function getDlqJobs(
  limit: number,
): Promise<AsyncJob[] | null> {
  try {
    const res = await axiosInstanceWithToken.get<AsyncJob[]>('/jobs/dlq', {
      params: { limit },
    });
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    throw err;
  }
}

