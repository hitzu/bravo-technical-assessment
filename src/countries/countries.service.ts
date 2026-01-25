import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { COUNTRY_STATUS } from '../common/types/country-status.type';
import type { CachePort } from '../cache/cache.port';
import { CACHE_PORT } from '../cache/cache.port';
import { Country } from './entities/country.entity';

const CACHE_KEY_ACTIVE_COUNTRIES = 'countries:active';
const TTL_ACTIVE_COUNTRIES_MS = 300_000;

@Injectable()
export class CountriesService {
  private readonly logger = new Logger(CountriesService.name);

  constructor(
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
    @Inject(CACHE_PORT)
    private readonly cache: CachePort,
  ) { }

  async findAllActive(): Promise<Country[]> {
    const cached = this.cache.get<Country[]>(CACHE_KEY_ACTIVE_COUNTRIES);
    if (cached !== undefined) {
      this.logger.log('Returning cached countries');
      return cached;
    }

    const countries = await this.countryRepository.find({
      where: { status: COUNTRY_STATUS.ACTIVE },
      order: { name: 'ASC' },
    });

    this.cache.set(CACHE_KEY_ACTIVE_COUNTRIES, countries, TTL_ACTIVE_COUNTRIES_MS);
    return countries;
  }

  async findByCode(code: string): Promise<Country | null> {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return null;

    return await this.countryRepository.findOne({
      where: { code: normalized },
    });
  }
}

