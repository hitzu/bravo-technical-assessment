import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { faker } from '@faker-js/faker';
import { Repository } from 'typeorm';

import { CountryFactory } from '@factories/country/country.factory';
import { CreditApplicationFactory } from '@factories/credit-application/credit-application.factory';
import { TenantFactory } from '@factories/tenant/tenant.factory';
import { CREDIT_APPLICATION_STATUS } from '../common/types/credit-application-status.type';
import { COUNTRY_STATUS } from '../common/types/country-status.type';
import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { CreditApplicationRiskService } from '../credit-applications/credit-application-risk.service';
import { BankProviderRegistryService } from '../credit-applications/bank-providers/bank-provider-registry.service';
import { ApplicationRiskResult } from '../credit-applications/entities/application-risk-result.entity';
import { CreditApplication } from '../credit-applications/entities/credit-applications.entity';
import { DefaultRiskStrategy } from '../credit-applications/risk-strategies/default-risk.strategy';
import { EsRiskStrategy } from '../credit-applications/risk-strategies/es-risk.strategy';
import { MxRiskStrategy } from '../credit-applications/risk-strategies/mx-risk.strategy';
import { RiskStrategyRegistryService } from '../credit-applications/risk-strategies/risk-strategy-registry.service';
import { RiskEvaluatorService } from '../credit-applications/risk-evaluator.service';
import { Country } from '../countries/entities/country.entity';
import { CountryRule } from '../countries/entities/country-rule.entity';
import { AsyncJobsProcessorService } from './async-jobs-processor.service';
import { AsyncJob } from './entities/async-job.entity';
import { ASYNC_JOB_STATUS } from './types/async-job-status.type';
import { ASYNC_JOB_TYPE } from './types/async-job-type.type';

describe('AsyncJobsProcessorService', () => {
  let service: AsyncJobsProcessorService;
  let asyncJobsRepo: Repository<AsyncJob>;
  let creditApplicationsRepo: Repository<CreditApplication>;
  let applicationRiskResultsRepo: Repository<ApplicationRiskResult>;
  let tenantFactory: TenantFactory;
  let countryFactory: CountryFactory;
  let creditApplicationFactory: CreditApplicationFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AsyncJobsProcessorService,
        CreditApplicationRiskService,
        BankProviderRegistryService,
        RiskEvaluatorService,
        RiskStrategyRegistryService,
        EsRiskStrategy,
        MxRiskStrategy,
        DefaultRiskStrategy,
        {
          provide: getRepositoryToken(AsyncJob),
          useValue: TestDataSource.getRepository(AsyncJob),
        },
        {
          provide: getRepositoryToken(CreditApplication),
          useValue: TestDataSource.getRepository(CreditApplication),
        },
        {
          provide: getRepositoryToken(ApplicationRiskResult),
          useValue: TestDataSource.getRepository(ApplicationRiskResult),
        },
        {
          provide: getRepositoryToken(Country),
          useValue: TestDataSource.getRepository(Country),
        },
        {
          provide: getRepositoryToken(CountryRule),
          useValue: TestDataSource.getRepository(CountryRule),
        },
      ],
    }).compile();

    service = module.get<AsyncJobsProcessorService>(AsyncJobsProcessorService);
    asyncJobsRepo = module.get<Repository<AsyncJob>>(getRepositoryToken(AsyncJob));
    creditApplicationsRepo = module.get<Repository<CreditApplication>>(
      getRepositoryToken(CreditApplication),
    );
    applicationRiskResultsRepo = module.get<Repository<ApplicationRiskResult>>(
      getRepositoryToken(ApplicationRiskResult),
    );
    tenantFactory = new TenantFactory(TestDataSource);
    countryFactory = new CountryFactory(TestDataSource);
    creditApplicationFactory = new CreditApplicationFactory(TestDataSource);
  });

  it('processes one PENDING job, persists risk result, and marks job DONE', async () => {
    // Arrange
    faker.seed(12345);
    const tenant = await tenantFactory.create();
    const country = await countryFactory.create({
      status: COUNTRY_STATUS.ACTIVE,
      code: 'ES',
    });
    const application = await creditApplicationsRepo.save(
      creditApplicationsRepo.create({
        ...(await creditApplicationFactory.make()),
        tenantId: tenant.id,
        countryId: country.id,
        status: CREDIT_APPLICATION_STATUS.PENDING,
        bankInfo: null,
      }),
    );

    const job = await asyncJobsRepo.save(
      asyncJobsRepo.create({
        tenantId: tenant.id,
        type: ASYNC_JOB_TYPE.RISK_EVAL,
        payload: { applicationId: application.id },
        status: ASYNC_JOB_STATUS.PENDING,
        attempts: 0,
        lastError: null,
        processedAt: null,
      }),
    );
    const pendingBefore = await asyncJobsRepo.count({
      where: { status: ASYNC_JOB_STATUS.PENDING },
    });
    expect(pendingBefore).toBe(1);

    // Act
    const result = await service.processPendingJobs(1);

    // Assert
    expect(result).toEqual({ processed: 1, dlq: 0 });

    const updatedJob = await asyncJobsRepo.findOne({ where: { id: job.id } });
    expect(updatedJob?.status).toBe(ASYNC_JOB_STATUS.DONE);
    expect(updatedJob?.processedAt).toBeInstanceOf(Date);

    const riskResult = await applicationRiskResultsRepo.findOne({
      where: { tenantId: tenant.id, applicationId: application.id },
      order: { createdAt: 'DESC' },
    });
    expect(riskResult).not.toBeNull();

    const updatedApplication = await creditApplicationsRepo.findOne({
      where: { id: application.id, tenantId: tenant.id },
    });
    expect(updatedApplication).not.toBeNull();
    const expectedStatus =
      riskResult?.decision === 'REVIEW'
        ? CREDIT_APPLICATION_STATUS.IN_REVIEW
        : CREDIT_APPLICATION_STATUS.PENDING;
    expect(updatedApplication?.status).toBe(expectedStatus);
  });
});

