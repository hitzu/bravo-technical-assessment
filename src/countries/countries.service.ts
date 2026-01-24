import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { COUNTRY_STATUS } from '../common/types/country-status.type';
import { Country } from './entities/country.entity';

@Injectable()
export class CountriesService {
  constructor(
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
  ) { }

  async findAllActive(): Promise<Country[]> {
    return await this.countryRepository.find({
      where: { status: COUNTRY_STATUS.ACTIVE },
      order: { name: 'ASC' },
    });
  }

  async findByCode(code: string): Promise<Country | null> {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return null;

    return await this.countryRepository.findOne({
      where: { code: normalized },
    });
  }
}

