import type { FactorizedAttrs } from '@jorgebodega/typeorm-factory';
import { Factory } from '@jorgebodega/typeorm-factory';
import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';

import { COUNTRY_STATUS } from '../../../src/common/types/country-status.type';
import { Country } from '../../../src/countries/entities/country.entity';

export class CountryFactory extends Factory<Country> {
  protected entity = Country;
  protected dataSource: DataSource;

  constructor(dataSource: DataSource) {
    super();
    this.dataSource = dataSource;
  }

  protected attrs(): FactorizedAttrs<Country> {
    return {
      code: faker.string.alpha({ length: 2 }).toUpperCase(),
      name: faker.location.country(),
      documentLabel: null,
      documentRegexPattern: null,
      status: faker.helpers.arrayElement<COUNTRY_STATUS>(
        Object.values(COUNTRY_STATUS),
      ),
    };
  }
}

