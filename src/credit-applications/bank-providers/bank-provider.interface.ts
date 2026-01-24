import type { BankSnapshot } from '../constants/risk.types';

export interface BankProvider {
  fetchBankInfo(documentId: string): Promise<BankSnapshot>;
}

