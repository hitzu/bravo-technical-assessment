import type { FactorizedAttrs } from '@jorgebodega/typeorm-factory';
import { Factory } from '@jorgebodega/typeorm-factory';
import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';

import { APPLICATION_RISK_DECISION } from '../../../src/credit-applications/constants/risk.types';
import { ApplicationRiskResult } from '../../../src/credit-applications/entities/application-risk-result.entity';

export class ApplicationRiskResultFactory extends Factory<ApplicationRiskResult> {
  protected entity = ApplicationRiskResult;
  protected dataSource: DataSource;

  constructor(dataSource: DataSource) {
    super();
    this.dataSource = dataSource;
  }

  protected attrs(): FactorizedAttrs<ApplicationRiskResult> {
    return {
      applicationId: faker.string.uuid(),
      tenantId: faker.string.uuid(),
      countryId: faker.string.uuid(),
      debtToIncomeRatio: faker.number.float({ min: 0, max: 10, fractionDigits: 4 }),
      riskScore: faker.number.int({ min: 0, max: 100 }),
      decision: faker.helpers.arrayElement<APPLICATION_RISK_DECISION>(
        Object.values(APPLICATION_RISK_DECISION),
      ),
      rawBankSnapshot: { source: 'factory', createdAt: faker.date.recent().toISOString() },
    };
  }
}

