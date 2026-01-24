import { faker } from '@faker-js/faker';

import type { BankSnapshot } from '../constants/risk.types';
import type { BankProvider } from './bank-provider.interface';

export class MxBankProvider implements BankProvider {
  async fetchBankInfo(documentId: string): Promise<BankSnapshot> {
    void documentId;
    const monthlyIncome = faker.number.int({ min: 6000, max: 90000 });
    const totalDebt = faker.number.int({ min: 0, max: 300000 });
    const productsCount = faker.number.int({ min: 0, max: 15 });

    return {
      countryCode: 'MX',
      provider: 'MX_FAKE_BANK',
      monthlyIncome,
      totalDebt,
      productsCount,
      generatedAt: new Date().toISOString(),
      rfcMasked: `***${faker.string.alphanumeric({ length: 6 }).toUpperCase()}`,
    };
  }
}

