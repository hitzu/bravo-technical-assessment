import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { CACHE_PORT } from '../cache/cache.port';
import { InMemoryCacheService } from '../cache/in-memory-cache.service';
import { COUNTRY_STATUS } from '../common/types/country-status.type';
import { CountryFactory } from '@factories/country/country.factory';
import { Country } from './entities/country.entity';
import { CountriesService } from './countries.service';

describe('CountriesService', () => {
  let service: CountriesService;
  let countryRepo: Repository<Country>;
  let countryFactory: CountryFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CountriesService,
        {
          provide: getRepositoryToken(Country),
          useValue: TestDataSource.getRepository(Country),
        },
        {
          provide: CACHE_PORT,
          useClass: InMemoryCacheService,
        },
      ],
    }).compile();

    service = module.get<CountriesService>(CountriesService);
    countryRepo = module.get<Repository<Country>>(getRepositoryToken(Country));
    countryFactory = new CountryFactory(TestDataSource);
  });

  describe('findAllActive', () => {
    it('returns only ACTIVE countries', async () => {
      // Arrange
      const activeA = await countryFactory.create({
        code: 'AR',
        name: 'Argentina',
        status: COUNTRY_STATUS.ACTIVE,
      });
      const activeB = await countryFactory.create({
        code: 'BR',
        name: 'Brazil',
        status: COUNTRY_STATUS.ACTIVE,
      });
      await countryFactory.create({
        code: 'ZZ',
        name: 'Zzzland',
        status: COUNTRY_STATUS.INACTIVE,
      });

      // Act
      const countries = await service.findAllActive();

      // Assert
      expect(countries.map((c) => c.id)).toEqual(
        expect.arrayContaining([activeA.id, activeB.id]),
      );
      expect(countries.every((c) => c.status === COUNTRY_STATUS.ACTIVE)).toBe(
        true,
      );
    });

    it('returns empty array when no ACTIVE countries exist', async () => {
      // Arrange
      await countryFactory.create({
        code: 'ZZ',
        name: 'Zzzland',
        status: COUNTRY_STATUS.INACTIVE,
      });

      // Act
      const countries = await service.findAllActive();

      // Assert
      expect(countries).toEqual([]);
    });

    it('caches active countries to avoid repeated DB hits', async () => {
      // Arrange
      await countryFactory.create({
        code: 'AR',
        name: 'Argentina',
        status: COUNTRY_STATUS.ACTIVE,
      });

      const findSpy = jest.spyOn(countryRepo, 'find');

      // Act
      const first = await service.findAllActive();
      const second = await service.findAllActive();

      // Assert
      expect(first).toHaveLength(1);
      expect(second).toHaveLength(1);
      expect(findSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('findByCode', () => {
    it.each(['es', ' ES ', 'eS'])(
      'normalizes input (trim + uppercase) and returns the matching country (%s)',
      async (input) => {
        // Arrange
        const country = await countryFactory.create({
          code: 'ES',
          name: 'Spain',
          status: COUNTRY_STATUS.ACTIVE,
        });

        // Act
        const found = await service.findByCode(input);

        // Assert
        expect(found?.id).toBe(country.id);
        expect(found?.code).toBe('ES');
      },
    );

    it.each(['', '   '])('returns null when code is blank (%s)', async (input) => {
      // Act
      const found = await service.findByCode(input);

      // Assert
      expect(found).toBeNull();
    });

    it('returns null when no country matches the normalized code', async () => {
      // Arrange
      await countryFactory.create({
        code: 'ES',
        name: 'Spain',
        status: COUNTRY_STATUS.ACTIVE,
      });

      // Act
      const found = await service.findByCode('xx');

      // Assert
      expect(found).toBeNull();
    });

    it('does not implicitly filter by status', async () => {
      // Arrange
      const inactive = await countryFactory.create({
        code: 'ES',
        name: 'Spain',
        status: COUNTRY_STATUS.INACTIVE,
      });

      // Act
      const found = await service.findByCode('ES');

      // Assert
      expect(found?.id).toBe(inactive.id);
      expect(found?.status).toBe(COUNTRY_STATUS.INACTIVE);
    });

    it('uses an exact code match (no partial match)', async () => {
      // Arrange
      await countryFactory.create({
        code: 'ES',
        name: 'Spain',
        status: COUNTRY_STATUS.ACTIVE,
      });

      // Act
      const found = await service.findByCode('ESP');

      // Assert
      expect(found).toBeNull();
    });

    it('persists factory-created countries correctly', async () => {
      // Arrange
      const created = await countryFactory.create({
        code: 'ES',
        name: 'Spain',
        status: COUNTRY_STATUS.ACTIVE,
      });

      // Act
      const persisted = await countryRepo.findOne({ where: { id: created.id } });

      // Assert
      expect(persisted).not.toBeNull();
      expect(persisted?.code).toBe('ES');
    });
  });
});

