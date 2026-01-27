import 'reflect-metadata';

import { AppDataSource } from '../../config/database/data-source';
import { COUNTRY_STATUS } from '../../common/types/country-status.type';
import { USER_ROLES } from '../../common/types/user-roles.type';
import { USER_STATUS } from '../../common/types/user-status.type';
import { Country } from '../../countries/entities/country.entity';
import { CountryRule } from '../../countries/entities/country-rule.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';

type SeedCountryInput = {
  code: string;
  name: string;
  status: COUNTRY_STATUS;
  documentLabel?: string | null;
  documentRegexPattern?: string | null;
  documentExample?: string | null;
};

type SeedTenantInput = {
  name: string;
};

type SeedUserInput = {
  tenantId: string;
  email: string;
  fullName: string;
  role: USER_ROLES;
  status: USER_STATUS;
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

// NOTE: These patterns are intentionally simplified for the assessment (basic sanity checks),
// not production-grade official document validation.
const COUNTRIES: SeedCountryInput[] = [
  {
    code: 'ES',
    name: 'Spain',
    status: COUNTRY_STATUS.INACTIVE,
    documentLabel: 'DNI/NIF',
    documentRegexPattern: '^[0-9]{7,8}[A-Z]$',
    documentExample: '01234567A',
  },
  {
    code: 'PT',
    name: 'Portugal',
    status: COUNTRY_STATUS.ACTIVE,
    documentLabel: 'NIF',
    documentRegexPattern: '^[0-9]{9}$',
    documentExample: '123456789',
  },
  {
    code: 'IT',
    name: 'Italy',
    status: COUNTRY_STATUS.INACTIVE,
    documentLabel: 'Codice fiscale',
    documentRegexPattern: '^[A-Z0-9]{11,16}$',
    documentExample: 'ABCDE12345678901',
  },
  {
    code: 'MX',
    name: 'Mexico',
    status: COUNTRY_STATUS.ACTIVE,
    documentLabel: 'CURP',
    documentRegexPattern: '^[A-Z0-9]{10,18}$',
    documentExample: 'XEXX010101HNMEXX04',
  },
  {
    code: 'CO',
    name: 'Colombia',
    status: COUNTRY_STATUS.INACTIVE,
    documentLabel: 'CC/NIT',
    documentRegexPattern: '^[0-9]{6,12}$',
    documentExample: '123456789012',
  },
  {
    code: 'BR',
    name: 'Brazil',
    status: COUNTRY_STATUS.INACTIVE,
    documentLabel: 'CPF',
    documentRegexPattern: '^[0-9]{11}$',
    documentExample: '12345678901',
  },
];

const TENANTS: SeedTenantInput[] = [
  { name: 'Reparadora de Crédito' },
  { name: 'Préstamos' },
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

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function upsertTenant(seed: SeedTenantInput): Promise<Tenant> {
  const repo = AppDataSource.getRepository(Tenant);
  const name = seed.name.trim();

  const existing = await repo.findOne({ where: { name } });
  if (existing) {
    existing.name = name;
    return await repo.save(existing);
  }

  const created = repo.create({ name });
  return await repo.save(created);
}

async function upsertUser(seed: SeedUserInput): Promise<User> {
  const repo = AppDataSource.getRepository(User);

  const existing = await repo.findOne({
    where: { tenantId: seed.tenantId, email: seed.email },
  });
  if (existing) {
    existing.fullName = seed.fullName;
    existing.role = seed.role;
    existing.status = seed.status;
    return await repo.save(existing);
  }

  const created = repo.create({
    tenantId: seed.tenantId,
    email: seed.email,
    fullName: seed.fullName,
    role: seed.role,
    status: seed.status,
  });
  return await repo.save(created);
}

async function upsertCountry(seed: SeedCountryInput): Promise<Country> {
  const repo = AppDataSource.getRepository(Country);
  const code = seed.code.trim().toUpperCase();

  const existing = await repo.findOne({ where: { code } });
  if (existing) {
    existing.name = seed.name;
    existing.status = seed.status;
    existing.documentLabel = seed.documentLabel ?? null;
    existing.documentRegexPattern = seed.documentRegexPattern ?? null;
    existing.documentExample = seed.documentExample ?? null;
    return await repo.save(existing);
  }

  const created = repo.create({
    code,
    name: seed.name,
    status: seed.status,
    documentLabel: seed.documentLabel ?? null,
    documentRegexPattern: seed.documentRegexPattern ?? null,
    documentExample: seed.documentExample ?? null,
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
    const tenants = new Map<string, Tenant>();
    for (const tenantSeed of TENANTS) {
      const tenant = await upsertTenant(tenantSeed);
      tenants.set(tenant.name, tenant);
    }

    const reparadora = tenants.get('Reparadora de Crédito');
    const prestamos = tenants.get('Préstamos');
    if (!reparadora || !prestamos) {
      throw new Error('Expected tenants to be created before users.');
    }

    const reparadoraSlug = slugify(reparadora.name);
    const prestamosSlug = slugify(prestamos.name);

    const users: SeedUserInput[] = [
      {
        tenantId: reparadora.id,
        email: `admin.${reparadoraSlug}@example.com`,
        fullName: 'José Luis Hernández',
        role: USER_ROLES.ADMIN,
        status: USER_STATUS.ACTIVE,
      },
      {
        tenantId: reparadora.id,
        email: `agent.${reparadoraSlug}@example.com`,
        fullName: 'María Fernanda García',
        role: USER_ROLES.AGENT,
        status: USER_STATUS.ACTIVE,
      },
      {
        tenantId: prestamos.id,
        email: `admin.${prestamosSlug}@example.com`,
        fullName: 'Juan Pablo Ramírez',
        role: USER_ROLES.ADMIN,
        status: USER_STATUS.ACTIVE,
      },
      {
        tenantId: prestamos.id,
        email: `agent.${prestamosSlug}@example.com`,
        fullName: 'Ana Sofía Martínez',
        role: USER_ROLES.AGENT,
        status: USER_STATUS.ACTIVE,
      },
    ];

    for (const user of users) {
      await upsertUser(user);
    }

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

