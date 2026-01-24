import 'reflect-metadata';

import { AppDataSource } from '../../config/database/data-source';
import { COUNTRY_STATUS } from '../../common/types/country-status.type';
import { Country } from '../../countries/entities/country.entity';
import { CountryRule } from '../../countries/entities/country-rule.entity';

type SeedCountryInput = {
  code: string;
  name: string;
  status: COUNTRY_STATUS;
};

type SeedCountryRuleInput = {
  countryCode: string;
  version: number;
  isActive: boolean;
  documentMinLength?: number | null;
  documentMaxLength?: number | null;
  dtiApproveMax?: number | null;
  dtiReviewMax?: number | null;
  requestedAmountReviewThreshold?: number | null;
  requestedAmountToMonthlyIncomeApproveMax?: number | null;
  requestedAmountToMonthlyIncomeReviewMax?: number | null;
  minMonthlyIncome?: number | null;
  minRiskScoreApprove?: number | null;
  minRiskScoreReview?: number | null;
};

const COUNTRIES: SeedCountryInput[] = [
  { code: 'ES', name: 'Spain', status: COUNTRY_STATUS.ACTIVE },
  { code: 'PT', name: 'Portugal', status: COUNTRY_STATUS.ACTIVE },
  { code: 'IT', name: 'Italy', status: COUNTRY_STATUS.ACTIVE },
  { code: 'MX', name: 'Mexico', status: COUNTRY_STATUS.ACTIVE },
  { code: 'CO', name: 'Colombia', status: COUNTRY_STATUS.ACTIVE },
  { code: 'BR', name: 'Brazil', status: COUNTRY_STATUS.ACTIVE },
];

// Minimal configs to test ES/MX strategies out of the box.
const COUNTRY_RULES: SeedCountryRuleInput[] = [
  {
    countryCode: 'ES',
    version: 1,
    isActive: true,
    documentMinLength: 9,
    documentMaxLength: 9,
    dtiApproveMax: 0.3,
    dtiReviewMax: 0.6,
    requestedAmountReviewThreshold: 10_000,
  },
  {
    countryCode: 'MX',
    version: 1,
    isActive: true,
    documentMinLength: 18,
    documentMaxLength: 18,
    dtiApproveMax: 0.25,
    dtiReviewMax: 0.55,
    requestedAmountToMonthlyIncomeApproveMax: 6,
    requestedAmountToMonthlyIncomeReviewMax: 12,
  },
];

async function upsertCountry(seed: SeedCountryInput): Promise<Country> {
  const repo = AppDataSource.getRepository(Country);
  const code = seed.code.trim().toUpperCase();

  const existing = await repo.findOne({ where: { code } });
  if (existing) {
    existing.name = seed.name;
    existing.status = seed.status;
    return await repo.save(existing);
  }

  const created = repo.create({
    code,
    name: seed.name,
    status: seed.status,
  });
  return await repo.save(created);
}

async function upsertCountryRule(seed: SeedCountryRuleInput): Promise<void> {
  const countryRepo = AppDataSource.getRepository(Country);
  const ruleRepo = AppDataSource.getRepository(CountryRule);

  const country = await countryRepo.findOne({
    where: { code: seed.countryCode.trim().toUpperCase() },
  });
  if (!country) {
    throw new Error(`Country not found for code: ${seed.countryCode}`);
  }

  if (seed.isActive) {
    await ruleRepo.update(
      { countryId: country.id, isActive: true },
      { isActive: false },
    );
  }

  const existing = await ruleRepo.findOne({
    where: { countryId: country.id, version: seed.version },
  });

  const payload: Partial<CountryRule> = {
    countryId: country.id,
    version: seed.version,
    isActive: seed.isActive,
    documentMinLength: seed.documentMinLength ?? null,
    documentMaxLength: seed.documentMaxLength ?? null,
    dtiApproveMax: seed.dtiApproveMax ?? null,
    dtiReviewMax: seed.dtiReviewMax ?? null,
    requestedAmountReviewThreshold: seed.requestedAmountReviewThreshold ?? null,
    requestedAmountToMonthlyIncomeApproveMax:
      seed.requestedAmountToMonthlyIncomeApproveMax ?? null,
    requestedAmountToMonthlyIncomeReviewMax:
      seed.requestedAmountToMonthlyIncomeReviewMax ?? null,
    minMonthlyIncome: seed.minMonthlyIncome ?? null,
    minRiskScoreApprove: seed.minRiskScoreApprove ?? null,
    minRiskScoreReview: seed.minRiskScoreReview ?? null,
  };

  if (existing) {
    await ruleRepo.update({ id: existing.id }, payload);
    return;
  }

  const created = ruleRepo.create(payload);
  await ruleRepo.save(created);
}

async function main(): Promise<void> {
  await AppDataSource.initialize();
  try {
    for (const country of COUNTRIES) {
      await upsertCountry(country);
    }
    for (const rule of COUNTRY_RULES) {
      await upsertCountryRule(rule);
    }
  } finally {
    await AppDataSource.destroy();
  }
}

void main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

