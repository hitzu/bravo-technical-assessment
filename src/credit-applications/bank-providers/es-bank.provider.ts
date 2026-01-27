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

export class EsBankProvider implements BankProvider {
  async fetchBankInfo(
    documentId: string,
    declaredMonthlyIncome?: number | null,
  ): Promise<BankSnapshot> {
    faker.seed(seedFromString(documentId));

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
      : faker.number.int({ min: 800, max: 6500 });

    const dti = faker.number.float({ min: 0.1, max: 0.7, fractionDigits: 4 });
    const totalDebt = Math.round(monthlyIncome * dti);
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

