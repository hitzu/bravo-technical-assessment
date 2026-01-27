import { Test, TestingModule } from '@nestjs/testing';

import { CreditApplicationFactory } from '@factories/credit-application/credit-application.factory';
import { CountryFactory } from '@factories/country/country.factory';
import { TenantFactory } from '@factories/tenant/tenant.factory';
import { UserFactory } from '@factories/user/user.factory';
import { COUNTRY_STATUS } from '../common/types/country-status.type';
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
      totalDebt: 200,
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
      totalDebt: 2000,
      productsCount: 3,
      generatedAt: new Date().toISOString(),
    };

    // Act
    const result = service.evaluateRisk('ES', application, snapshot);

    // Assert
    expect(result.decision).toBe(APPLICATION_RISK_DECISION.REJECT);
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
      monthlyIncome: 10_000,
      requestedAmount: 10_000,
      createdBy: user.id,
    });
    const snapshot: BankSnapshot = {
      countryCode: 'MX',
      provider: 'TEST',
      monthlyIncome: 10000,
      totalDebt: 2000,
      productsCount: 2,
      generatedAt: new Date().toISOString(),
    };

    // Act
    const result = service.evaluateRisk('MX', application, snapshot);

    // Assert
    expect(result.decision).toBe(APPLICATION_RISK_DECISION.APPROVE);
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
      monthlyIncome: 1_000,
      requestedAmount: 200_000,
      createdBy: user.id,
    });
    const snapshot: BankSnapshot = {
      countryCode: 'MX',
      provider: 'TEST',
      monthlyIncome: 10000,
      totalDebt: 8000,
      productsCount: 5,
      generatedAt: new Date().toISOString(),
    };

    // Act
    const result = service.evaluateRisk('MX', application, snapshot);

    // Assert
    expect(result.decision).toBe(APPLICATION_RISK_DECISION.REJECT);
  });
});

