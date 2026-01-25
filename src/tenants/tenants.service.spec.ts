import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TenantFactory } from '@factories/tenant/tenant.factory';
import { CACHE_PORT } from '../cache/cache.port';
import { InMemoryCacheService } from '../cache/in-memory-cache.service';
import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { Tenant } from './entities/tenant.entity';
import { TenantsService } from './tenants.service';

describe('TenantsService', () => {
  let service: TenantsService;
  let repository: Repository<Tenant>;
  let tenantFactory: TenantFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: TestDataSource.getRepository(Tenant),
        },
        {
          provide: CACHE_PORT,
          useClass: InMemoryCacheService,
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    repository = module.get<Repository<Tenant>>(getRepositoryToken(Tenant));
    tenantFactory = new TenantFactory(TestDataSource);
  });

  it('creates a tenant with generated id', async () => {
    const tenantAttrs = await tenantFactory.make();
    const dto: CreateTenantDto = { name: tenantAttrs.name };

    const tenant = await service.createTenant(dto);
    const persisted = await repository.findOne({ where: { id: tenant.id } });

    expect(tenant.id).toBeDefined();
    expect(tenant.name).toBe(dto.name);
    expect(persisted).not.toBeNull();
    expect(persisted?.name).toBe(dto.name);
  });

  it('returns empty array when no tenants exist', async () => {
    const tenants = await service.findAll();
    expect(Array.isArray(tenants)).toBe(true);
    expect(tenants).toHaveLength(0);
  });

  it('lists existing tenants', async () => {
    const tenantA = await tenantFactory.create();
    const tenantB = await tenantFactory.create();

    const tenants = await service.findAll();
    const tenantIds = tenants.map((t) => t.id);

    expect(tenants).toHaveLength(2);
    expect(tenantIds).toEqual(expect.arrayContaining([tenantA.id, tenantB.id]));
  });
});
