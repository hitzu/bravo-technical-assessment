import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreditApplicationFactory } from '@factories/credit-application/credit-application.factory';
import { CountryFactory } from '@factories/country/country.factory';
import { TenantFactory } from '@factories/tenant/tenant.factory';
import type { AuthUserRole } from '../auth/types/auth-user-context';
import { USER_ROLES } from '../common/types/user-roles.type';
import { CREDIT_APPLICATION_STATUS } from '../common/types/credit-application-status.type';
import { COUNTRY_STATUS } from '../common/types/country-status.type';
import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';
import type { CreateCreditApplicationDto } from './dto/create-credit-application.dto';
import type { ListCreditApplicationsQueryDto } from './dto/list-credit-applications.query.dto';
import { CreditApplicationsService } from './credit-applications.service';
import { CreditApplication } from './entities/credit-applications.entity';

describe('CreditApplicationsService', () => {
  let service: CreditApplicationsService;
  let creditAppRepo: Repository<CreditApplication>;
  let tenantFactory: TenantFactory;
  let countryFactory: CountryFactory;
  let creditApplicationFactory: CreditApplicationFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditApplicationsService,
        {
          provide: getRepositoryToken(CreditApplication),
          useValue: TestDataSource.getRepository(CreditApplication),
        },
      ],
    }).compile();

    service = module.get<CreditApplicationsService>(CreditApplicationsService);
    creditAppRepo = module.get<Repository<CreditApplication>>(
      getRepositoryToken(CreditApplication),
    );
    tenantFactory = new TenantFactory(TestDataSource);
    countryFactory = new CountryFactory(TestDataSource);
    creditApplicationFactory = new CreditApplicationFactory(TestDataSource);
  });

  describe('createApplication', () => {
    it('creates application, defaults status to PENDING, and persists it', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const country = await countryFactory.create({
        status: COUNTRY_STATUS.ACTIVE,
      });
      const userId = '0d3a3e64-3af4-46c4-9e2d-56c1920fd5a9';

      const dto: CreateCreditApplicationDto = {
        countryId: country.id,
        fullName: 'Jane Doe',
        documentId: 'DOC-123',
        monthlyIncome: 0,
        requestedAmount: 0,
      };

      // Act
      const created = await service.createApplication(
        tenant.id,
        userId,
        USER_ROLES.AGENT,
        dto,
      );
      const persisted = await creditAppRepo.findOne({
        where: { id: created.id },
      });

      // Assert
      expect(created.id).toBeDefined();
      expect(created.tenantId).toBe(tenant.id);
      expect(created.createdBy).toBe(userId);
      expect(created.countryId).toBe(country.id);
      expect(created.fullName).toBe(dto.fullName);
      expect(created.documentId).toBe(dto.documentId);
      expect(created.monthlyIncome).toBe(dto.monthlyIncome);
      expect(created.requestedAmount).toBe(dto.requestedAmount);
      expect(created.status).toBe(CREDIT_APPLICATION_STATUS.PENDING);
      expect(created.bankInfo).toBeNull();
      expect(persisted).not.toBeNull();
    });

    it('throws BadRequestException when monthlyIncome is negative', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const country = await countryFactory.create();
      const dto: CreateCreditApplicationDto = {
        countryId: country.id,
        fullName: 'Jane Doe',
        documentId: 'DOC-123',
        monthlyIncome: -1,
        requestedAmount: 100,
      };

      // Act / Assert
      await expect(
        service.createApplication(
          tenant.id,
          '00000000-0000-0000-0000-000000000001',
          USER_ROLES.ADMIN,
          dto,
        ),
      ).rejects.toEqual(new BadRequestException('monthlyIncome must be >= 0'));
    });

    it('throws BadRequestException when requestedAmount is negative', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const country = await countryFactory.create();
      const dto: CreateCreditApplicationDto = {
        countryId: country.id,
        fullName: 'Jane Doe',
        documentId: 'DOC-123',
        monthlyIncome: 100,
        requestedAmount: -1,
      };

      // Act / Assert
      await expect(
        service.createApplication(
          tenant.id,
          '00000000-0000-0000-0000-000000000001',
          USER_ROLES.ADMIN,
          dto,
        ),
      ).rejects.toEqual(new BadRequestException('requestedAmount must be >= 0'));
    });

    it('throws ForbiddenException when role is not allowed', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const country = await countryFactory.create();
      const dto: CreateCreditApplicationDto = {
        countryId: country.id,
        fullName: 'Jane Doe',
        documentId: 'DOC-123',
        monthlyIncome: 100,
        requestedAmount: 100,
      };
      const invalidRole = 'HACKER' as unknown as AuthUserRole;

      // Act / Assert
      await expect(
        service.createApplication(
          tenant.id,
          '00000000-0000-0000-0000-000000000001',
          invalidRole,
          dto,
        ),
      ).rejects.toEqual(new ForbiddenException(EXCEPTION_RESPONSE.INSUFFICIENT_ROLE));
    });
  });

  describe('listApplications', () => {
    it('returns default pagination values when page/pageSize are not provided', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const country = await countryFactory.create();
      await creditApplicationFactory.create({
        tenantId: tenant.id,
        countryId: country.id,
      });
      await creditApplicationFactory.create({
        tenantId: tenant.id,
        countryId: country.id,
      });
      await creditApplicationFactory.create({
        tenantId: tenant.id,
        countryId: country.id,
      });

      // Act
      const result = await service.listApplications(
        tenant.id,
        '00000000-0000-0000-0000-000000000001',
        USER_ROLES.ADMIN,
        {},
      );

      // Assert
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(3);
    });

    it('scopes results by tenantId', async () => {
      // Arrange
      const tenantA = await tenantFactory.create();
      const tenantB = await tenantFactory.create();
      const country = await countryFactory.create();

      const inA = await creditApplicationFactory.create({
        tenantId: tenantA.id,
        countryId: country.id,
      });
      await creditApplicationFactory.create({
        tenantId: tenantB.id,
        countryId: country.id,
      });

      // Act
      const result = await service.listApplications(
        tenantA.id,
        '00000000-0000-0000-0000-000000000001',
        USER_ROLES.ADMIN,
        {},
      );

      // Assert
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe(inA.id);
      expect(result.data[0]?.tenantId).toBe(tenantA.id);
    });

    it('scopes AGENT results by createdBy (only mine)', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const country = await countryFactory.create();
      const userA = '00000000-0000-0000-0000-0000000000aa';
      const userB = '00000000-0000-0000-0000-0000000000bb';

      const mine = await creditApplicationFactory.create({
        tenantId: tenant.id,
        countryId: country.id,
        createdBy: userA,
      });
      await creditApplicationFactory.create({
        tenantId: tenant.id,
        countryId: country.id,
        createdBy: userB,
      });

      // Act
      const result = await service.listApplications(
        tenant.id,
        userA,
        USER_ROLES.AGENT,
        {},
      );

      // Assert
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe(mine.id);
      expect(result.data[0]?.createdBy).toBe(userA);
    });

    it('applies countryId and status filters', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const countryA = await countryFactory.create();
      const countryB = await countryFactory.create();

      const match = await creditApplicationFactory.create({
        tenantId: tenant.id,
        countryId: countryA.id,
        status: CREDIT_APPLICATION_STATUS.PENDING,
      });
      await creditApplicationFactory.create({
        tenantId: tenant.id,
        countryId: countryA.id,
        status: CREDIT_APPLICATION_STATUS.APPROVED,
      });
      await creditApplicationFactory.create({
        tenantId: tenant.id,
        countryId: countryB.id,
        status: CREDIT_APPLICATION_STATUS.PENDING,
      });

      const filters: ListCreditApplicationsQueryDto = {
        countryId: countryA.id,
        status: CREDIT_APPLICATION_STATUS.PENDING,
      };

      // Act
      const result = await service.listApplications(
        tenant.id,
        '00000000-0000-0000-0000-000000000001',
        USER_ROLES.ADMIN,
        filters,
      );

      // Assert
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe(match.id);
      expect(result.data[0]?.countryId).toBe(countryA.id);
      expect(result.data[0]?.status).toBe(CREDIT_APPLICATION_STATUS.PENDING);
    });

    it('paginates using page and pageSize', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const country = await countryFactory.create();
      for (let i = 0; i < 25; i++) {
        await creditApplicationFactory.create({
          tenantId: tenant.id,
          countryId: country.id,
        });
      }

      // Act
      const result = await service.listApplications(
        tenant.id,
        '00000000-0000-0000-0000-000000000001',
        USER_ROLES.ADMIN,
        { page: 2, pageSize: 20 },
      );

      // Assert
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(20);
      expect(result.data).toHaveLength(5);
    });
  });

  describe('getApplication', () => {
    it('throws NotFoundException when application does not exist in tenant', async () => {
      // Arrange
      const tenant = await tenantFactory.create();

      // Act / Assert
      await expect(
        service.getApplication(
          tenant.id,
          '00000000-0000-0000-0000-000000000001',
          USER_ROLES.ADMIN,
          '00000000-0000-0000-0000-000000000000',
        ),
      ).rejects.toEqual(new NotFoundException('Credit application not found'));
    });

    it('allows ADMIN to fetch an application in the same tenant', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const country = await countryFactory.create();
      const app = await creditApplicationFactory.create({
        tenantId: tenant.id,
        countryId: country.id,
        createdBy: '00000000-0000-0000-0000-0000000000aa',
      });

      // Act
      const found = await service.getApplication(
        tenant.id,
        '00000000-0000-0000-0000-0000000000bb',
        USER_ROLES.ADMIN,
        app.id,
      );

      // Assert
      expect(found.id).toBe(app.id);
    });

    it('allows AGENT to fetch their own application', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const country = await countryFactory.create();
      const userId = '00000000-0000-0000-0000-0000000000aa';
      const app = await creditApplicationFactory.create({
        tenantId: tenant.id,
        countryId: country.id,
        createdBy: userId,
      });

      // Act
      const found = await service.getApplication(
        tenant.id,
        userId,
        USER_ROLES.AGENT,
        app.id,
      );

      // Assert
      expect(found.id).toBe(app.id);
    });

    it('throws ForbiddenException when AGENT tries to fetch another agent’s application', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const country = await countryFactory.create();
      const app = await creditApplicationFactory.create({
        tenantId: tenant.id,
        countryId: country.id,
        createdBy: '00000000-0000-0000-0000-0000000000aa',
      });

      // Act / Assert
      await expect(
        service.getApplication(
          tenant.id,
          '00000000-0000-0000-0000-0000000000bb',
          USER_ROLES.AGENT,
          app.id,
        ),
      ).rejects.toEqual(new ForbiddenException(EXCEPTION_RESPONSE.INSUFFICIENT_ROLE));
    });
  });

  describe('updateStatus', () => {
    it('throws ForbiddenException when role is not ADMIN', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const country = await countryFactory.create();
      const app = await creditApplicationFactory.create({
        tenantId: tenant.id,
        countryId: country.id,
      });

      // Act / Assert
      await expect(
        service.updateStatus(
          tenant.id,
          '00000000-0000-0000-0000-000000000001',
          USER_ROLES.AGENT,
          app.id,
          CREDIT_APPLICATION_STATUS.IN_REVIEW,
        ),
      ).rejects.toEqual(new ForbiddenException(EXCEPTION_RESPONSE.INSUFFICIENT_ROLE));
    });

    it('throws NotFoundException when application is missing', async () => {
      // Arrange
      const tenant = await tenantFactory.create();

      // Act / Assert
      await expect(
        service.updateStatus(
          tenant.id,
          '00000000-0000-0000-0000-000000000001',
          USER_ROLES.ADMIN,
          '00000000-0000-0000-0000-000000000000',
          CREDIT_APPLICATION_STATUS.IN_REVIEW,
        ),
      ).rejects.toEqual(new NotFoundException('Credit application not found'));
    });

    it('throws BadRequestException for invalid terminal-to-terminal transition', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const country = await countryFactory.create();
      const app = await creditApplicationFactory.create({
        tenantId: tenant.id,
        countryId: country.id,
        status: CREDIT_APPLICATION_STATUS.APPROVED,
      });

      // Act / Assert
      await expect(
        service.updateStatus(
          tenant.id,
          '00000000-0000-0000-0000-000000000001',
          USER_ROLES.ADMIN,
          app.id,
          CREDIT_APPLICATION_STATUS.REJECTED,
        ),
      ).rejects.toEqual(
        new BadRequestException(
          'Invalid status transition from APPROVED to REJECTED',
        ),
      );
    });

    it('allows terminal-to-same-terminal transition', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const country = await countryFactory.create();
      const app = await creditApplicationFactory.create({
        tenantId: tenant.id,
        countryId: country.id,
        status: CREDIT_APPLICATION_STATUS.APPROVED,
      });

      // Act
      const updated = await service.updateStatus(
        tenant.id,
        '00000000-0000-0000-0000-000000000001',
        USER_ROLES.ADMIN,
        app.id,
        CREDIT_APPLICATION_STATUS.APPROVED,
      );
      const persisted = await creditAppRepo.findOne({ where: { id: app.id } });

      // Assert
      expect(updated.status).toBe(CREDIT_APPLICATION_STATUS.APPROVED);
      expect(persisted?.status).toBe(CREDIT_APPLICATION_STATUS.APPROVED);
    });

    it('updates status and persists it', async () => {
      // Arrange
      const tenant = await tenantFactory.create();
      const country = await countryFactory.create();
      const app = await creditApplicationFactory.create({
        tenantId: tenant.id,
        countryId: country.id,
        status: CREDIT_APPLICATION_STATUS.PENDING,
      });

      // Act
      const updated = await service.updateStatus(
        tenant.id,
        '00000000-0000-0000-0000-000000000001',
        USER_ROLES.ADMIN,
        app.id,
        CREDIT_APPLICATION_STATUS.IN_REVIEW,
      );
      const persisted = await creditAppRepo.findOne({ where: { id: app.id } });

      // Assert
      expect(updated.status).toBe(CREDIT_APPLICATION_STATUS.IN_REVIEW);
      expect(persisted?.status).toBe(CREDIT_APPLICATION_STATUS.IN_REVIEW);
    });
  });
});

