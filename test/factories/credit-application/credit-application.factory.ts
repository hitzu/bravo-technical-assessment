import type { FactorizedAttrs } from '@jorgebodega/typeorm-factory';
import { Factory } from '@jorgebodega/typeorm-factory';
import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';

import { CREDIT_APPLICATION_STATUS } from '../../../src/common/types/credit-application-status.type';
import { CreditApplication } from '../../../src/credit-applications/entities/credit-applications.entity';

export class CreditApplicationFactory extends Factory<CreditApplication> {
  protected entity = CreditApplication;
  protected dataSource: DataSource;

  constructor(dataSource: DataSource) {
    super();
    this.dataSource = dataSource;
  }

  protected attrs(): FactorizedAttrs<CreditApplication> {
    return {
      tenantId: faker.string.uuid(),
      createdBy: faker.string.uuid(),
      countryId: faker.string.uuid(),
      fullName: faker.person.fullName(),
      documentId: faker.string.alphanumeric({ length: 12 }),
      monthlyIncome: faker.number.int({ min: 0, max: 250_000 }),
      requestedAmount: faker.number.int({ min: 0, max: 1_000_000 }),
      status: faker.helpers.arrayElement<CREDIT_APPLICATION_STATUS>(
        Object.values(CREDIT_APPLICATION_STATUS),
      ),
      bankInfo: null,
    };
  }
}

