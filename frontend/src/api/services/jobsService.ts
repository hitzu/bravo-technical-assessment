import axios from 'axios';

import type { DlqRiskEvaluation, PaginatedResponse } from '../types/api';
import { axiosInstanceWithToken } from '../config/axiosConfig';

export async function getDlqJobs(): Promise<DlqRiskEvaluation[] | null> {
  try {
    const res = await axiosInstanceWithToken.get<
      PaginatedResponse<DlqRiskEvaluation>
    >(
      '/applications/risk-evaluations/dlq',
      {
        // Avoid browser caching turning into 304 (Axios treats 304 as error)
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      },
    );
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    throw err;
  }
}

