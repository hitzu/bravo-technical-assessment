import { Test, TestingModule } from '@nestjs/testing';

import { CreditApplicationFactory } from '@factories/credit-application/credit-application.factory';
import { CountryFactory } from '@factories/country/country.factory';
import { TenantFactory } from '@factories/tenant/tenant.factory';
import { UserFactory } from '@factories/user/user.factory';
import { COUNTRY_STATUS } from '../common/types/country-status.type';
import type { CountryRule } from '../countries/entities/country-rule.entity';
import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { APPLICATION_RISK_DECISION } from './constants/risk.types';
import type { BankSnapshot } from './constants/risk.types';
import { RiskEvaluatorService } from './risk-evaluator.service';
import { DefaultRiskStrategy } from './risk-strategies/default-risk.strategy';
import { EsRiskStrategy } from './risk-strategies/es-risk.strategy';
import { MxRiskStrategy } from './risk-strategies/mx-risk.strategy';
import { RiskStrategyRegistryService } from './risk-strategies/risk-strategy-registry.service';

describe('RiskEvaluatorService', () => {
  let service: RiskEvaluatorService;
  let tenantFactory: TenantFactory;
  let countryFactory: CountryFactory;
  let creditApplicationFactory: CreditApplicationFactory;
  let userFactory: UserFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskEvaluatorService,
        RiskStrategyRegistryService,
        EsRiskStrategy,
        MxRiskStrategy,
        DefaultRiskStrategy,
      ],
    }).compile();

    service = module.get<RiskEvaluatorService>(RiskEvaluatorService);
    tenantFactory = new TenantFactory(TestDataSource);
    countryFactory = new CountryFactory(TestDataSource);
    creditApplicationFactory = new CreditApplicationFactory(TestDataSource);
    userFactory = new UserFactory(TestDataSource);
  });

  it('returns APPROVE for ES low risk case', async () => {
    // Arrange
    const tenant = await tenantFactory.create();
    const user = await userFactory.create({ tenant });
    const country = await countryFactory.create({
      code: 'ES',
      status: COUNTRY_STATUS.ACTIVE,
    });
    const application = await creditApplicationFactory.create({
      tenantId: tenant.id,
      countryId: country.id,
      monthlyIncome: 10_000,
      requestedAmount: 1_000,
      createdBy: user.id,
    });
    const snapshot: BankSnapshot = {
      countryCode: 'ES',
      provider: 'TEST',
      monthlyIncome: 2000,
      totalDebt: 500,
      productsCount: 1,
      generatedAt: new Date().toISOString(),
    };

    // Act
    const result = service.evaluateRisk('ES', application, snapshot);

    // Assert
    expect(result.decision).toBe(APPLICATION_RISK_DECISION.APPROVE);
  });

  it('returns REJECT for ES high risk case', async () => {
    // Arrange
    const tenant = await tenantFactory.create();
    const user = await userFactory.create({ tenant });
    const country = await countryFactory.create({
      code: 'ES',
      status: COUNTRY_STATUS.ACTIVE,
    });
    const application = await creditApplicationFactory.create({
      tenantId: tenant.id,
      countryId: country.id,
      monthlyIncome: 1_000,
      requestedAmount: 200_000,
      createdBy: user.id,
    });
    const snapshot: BankSnapshot = {
      countryCode: 'ES',
      provider: 'TEST',
      monthlyIncome: 2000,
      totalDebt: 1500,
      productsCount: 3,
      generatedAt: new Date().toISOString(),
    };

    // Act
    const result = service.evaluateRisk('ES', application, snapshot);

    // Assert
    expect(result.decision).toBe(APPLICATION_RISK_DECISION.REJECT);
  });

  it('returns REVIEW for ES when large amount triggers the optional hook', async () => {
    // Arrange
    const tenant = await tenantFactory.create();
    const user = await userFactory.create({ tenant });
    const country = await countryFactory.create({
      code: 'ES',
      status: COUNTRY_STATUS.ACTIVE,
    });
    const application = await creditApplicationFactory.create({
      tenantId: tenant.id,
      countryId: country.id,
      monthlyIncome: 50_000,
      requestedAmount: 35_000,
      createdBy: user.id,
    });
    const snapshot: BankSnapshot = {
      countryCode: 'ES',
      provider: 'TEST',
      monthlyIncome: 50_000,
      totalDebt: 5_000,
      productsCount: 2,
      generatedAt: new Date().toISOString(),
    };

    // Act
    const rule = {
      requestedAmountReviewThreshold: 10_000,
    } as unknown as CountryRule;
    const result = service.evaluateRisk('ES', application, snapshot, rule);

    // Assert
    expect(result.decision).toBe(APPLICATION_RISK_DECISION.REVIEW);
  });

  it('returns APPROVE for MX low risk case', async () => {
    // Arrange
    const tenant = await tenantFactory.create();
    const user = await userFactory.create({ tenant });
    const country = await countryFactory.create({
      code: 'MX',
      status: COUNTRY_STATUS.ACTIVE,
    });
    const application = await creditApplicationFactory.create({
      tenantId: tenant.id,
      countryId: country.id,
      monthlyIncome: 50_000,
      requestedAmount: 5_000,
      createdBy: user.id,
    });
    const snapshot: BankSnapshot = {
      countryCode: 'MX',
      provider: 'TEST',
      monthlyIncome: 50_000,
      totalDebt: 8_000,
      productsCount: 2,
      generatedAt: new Date().toISOString(),
    };

    // Act
    const result = service.evaluateRisk('MX', application, snapshot);

    // Assert
    expect(result.decision).toBe(APPLICATION_RISK_DECISION.APPROVE);
  });

  it('returns REVIEW for MX when requested amount ratio is moderate', async () => {
    // Arrange
    const tenant = await tenantFactory.create();
    const user = await userFactory.create({ tenant });
    const country = await countryFactory.create({
      code: 'MX',
      status: COUNTRY_STATUS.ACTIVE,
    });
    const application = await creditApplicationFactory.create({
      tenantId: tenant.id,
      countryId: country.id,
      monthlyIncome: 50_000,
      requestedAmount: 35_000,
      createdBy: user.id,
    });
    const snapshot: BankSnapshot = {
      countryCode: 'MX',
      provider: 'TEST',
      monthlyIncome: 50_000,
      totalDebt: 12_000,
      productsCount: 3,
      generatedAt: new Date().toISOString(),
    };

    // Act
    const result = service.evaluateRisk('MX', application, snapshot);

    // Assert
    expect(result.decision).toBe(APPLICATION_RISK_DECISION.REVIEW);
  });

  it('returns REJECT for MX high risk case', async () => {
    // Arrange
    const tenant = await tenantFactory.create();
    const user = await userFactory.create({ tenant });
    const country = await countryFactory.create({
      code: 'MX',
      status: COUNTRY_STATUS.ACTIVE,
    });
    const application = await creditApplicationFactory.create({
      tenantId: tenant.id,
      countryId: country.id,
      monthlyIncome: 7_000,
      requestedAmount: 30_000,
      createdBy: user.id,
    });
    const snapshot: BankSnapshot = {
      countryCode: 'MX',
      provider: 'TEST',
      monthlyIncome: 7_000,
      totalDebt: 3_000,
      productsCount: 1,
      generatedAt: new Date().toISOString(),
    };

    // Act
    const result = service.evaluateRisk('MX', application, snapshot);

    // Assert
    expect(result.decision).toBe(APPLICATION_RISK_DECISION.REJECT);
  });
});

