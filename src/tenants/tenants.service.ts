import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { CachePort } from '../cache/cache.port';
import { CACHE_PORT } from '../cache/cache.port';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { Tenant } from './entities/tenant.entity';

const CACHE_KEY_ALL_TENANTS = 'tenants:all';
const TTL_ALL_TENANTS_MS = 120_000;

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @Inject(CACHE_PORT)
    private readonly cache: CachePort,
  ) { }

  async createTenant(createTenantDto: CreateTenantDto): Promise<Tenant> {
    this.logger.log({ name: createTenantDto.name }, 'Creating tenant');

    const tenant = this.tenantRepository.create(createTenantDto);
    const saved = await this.tenantRepository.save(tenant);
    this.cache.del(CACHE_KEY_ALL_TENANTS);
    return saved;
  }

  async findAll(): Promise<Tenant[]> {
    this.logger.log('Listing tenants');
    const cached = this.cache.get<Tenant[]>(CACHE_KEY_ALL_TENANTS);
    if (cached !== undefined) {
      this.logger.log('Returning cached tenants');
      return cached;
    }

    const tenants = await this.tenantRepository.find();
    this.cache.set(CACHE_KEY_ALL_TENANTS, tenants, TTL_ALL_TENANTS_MS);
    return tenants;
  }
}
