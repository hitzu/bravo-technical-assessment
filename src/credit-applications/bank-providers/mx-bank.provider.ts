import { faker } from '@faker-js/faker';

import type { BankSnapshot } from '../constants/risk.types';
import type { BankProvider } from './bank-provider.interface';

function seedFromString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class MxBankProvider implements BankProvider {
  async fetchBankInfo(
    documentId: string,
    declaredMonthlyIncome?: number | null,
  ): Promise<BankSnapshot> {
    faker.seed(seedFromString('123456789'));

    const hasValidDeclaredIncome =
      typeof declaredMonthlyIncome === 'number' &&
      Number.isFinite(declaredMonthlyIncome) &&
      declaredMonthlyIncome > 0;

    const monthlyIncome = hasValidDeclaredIncome
      ? Math.max(
        1,
        Math.round(
          declaredMonthlyIncome *
          faker.number.float({ min: 0.95, max: 1.05, fractionDigits: 4 }),
        ),
      )
      : faker.number.int({ min: 6000, max: 90000 });

    const dti = faker.number.float({ min: 0.1, max: 0.7, fractionDigits: 4 });
    const totalDebt = Math.round(monthlyIncome * dti);
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

