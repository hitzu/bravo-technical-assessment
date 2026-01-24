import { faker } from '@faker-js/faker';

import type { BankSnapshot } from '../constants/risk.types';
import type { BankProvider } from './bank-provider.interface';

export class EsBankProvider implements BankProvider {
  async fetchBankInfo(documentId: string): Promise<BankSnapshot> {
    void documentId;
    const monthlyIncome = faker.number.int({ min: 800, max: 6500 });
    const totalDebt = faker.number.int({ min: 0, max: 25000 });
    const productsCount = faker.number.int({ min: 0, max: 10 });

    return {
      countryCode: 'ES',
      provider: 'ES_FAKE_BANK',
      monthlyIncome,
      totalDebt,
      productsCount,
      generatedAt: new Date().toISOString(),
      ibanMasked: `ES**${faker.string.numeric({ length: 8 })}`,
    };
  }
}

