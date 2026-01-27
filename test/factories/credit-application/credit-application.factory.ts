import type { FactorizedAttrs } from '@jorgebodega/typeorm-factory';
import { Factory } from '@jorgebodega/typeorm-factory';
import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';

import { CREDIT_APPLICATION_STATUS } from '../../../src/common/types/credit-application-status.type';
import { CreditApplication } from '../../../src/credit-applications/entities/credit-applications.entity';
import { CountryFactory } from '../country/country.factory';
import { TenantFactory } from '../tenant/tenant.factory';
import { UserFactory } from '../user/user.factory';

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
      forceRiskFailure: false,
    };
  }

  async make(
    overrideParams?: Partial<FactorizedAttrs<CreditApplication>>,
  ): Promise<CreditApplication> {
    const resolved = await this.resolveForeignKeys(overrideParams);
    return super.make(resolved);
  }

  async makeMany(
    amount: number,
    overrideParams?: Partial<FactorizedAttrs<CreditApplication>>,
  ): Promise<CreditApplication[]> {
    const created: CreditApplication[] = [];
    for (let i = 0; i < amount; i += 1) {
      created.push(await this.make(overrideParams));
    }
    return created;
  }

  async create(
    overrideParams?: Partial<FactorizedAttrs<CreditApplication>>,
  ): Promise<CreditApplication> {
    const resolved = await this.resolveForeignKeys(overrideParams);
    return super.create(resolved);
  }

  async createMany(
    amount: number,
    overrideParams?: Partial<FactorizedAttrs<CreditApplication>>,
  ): Promise<CreditApplication[]> {
    const created: CreditApplication[] = [];
    for (let i = 0; i < amount; i += 1) {
      created.push(await this.create(overrideParams));
    }
    return created;
  }

  private async resolveForeignKeys(
    overrideParams?: Partial<FactorizedAttrs<CreditApplication>>,
  ): Promise<Partial<FactorizedAttrs<CreditApplication>>> {
    const tenantFactory = new TenantFactory(this.dataSource);
    const countryFactory = new CountryFactory(this.dataSource);
    const userFactory = new UserFactory(this.dataSource);

    const tenantId =
      overrideParams?.tenantId ?? (await tenantFactory.create()).id;

    const countryId =
      overrideParams?.countryId ?? (await countryFactory.create()).id;

    const createdBy =
      overrideParams?.createdBy ?? (await userFactory.createForTenant(tenantId)).id;

    return {
      ...overrideParams,
      tenantId,
      countryId,
      createdBy,
    };
  }
}

