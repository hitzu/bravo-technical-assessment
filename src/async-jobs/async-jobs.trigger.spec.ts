import { Repository } from 'typeorm';

import { CountryFactory } from '@factories/country/country.factory';
import { TenantFactory } from '@factories/tenant/tenant.factory';
import { CREDIT_APPLICATION_STATUS } from '../common/types/credit-application-status.type';
import { COUNTRY_STATUS } from '../common/types/country-status.type';
import { AppDataSource as TestDataSource } from '../config/database/data-source';
import { CreditApplication } from '../credit-applications/entities/credit-applications.entity';
import { AsyncJob } from './entities/async-job.entity';
import { ASYNC_JOB_STATUS } from './types/async-job-status.type';
import { ASYNC_JOB_TYPE } from './types/async-job-type.type';

async function ensureRiskEnqueueTrigger(): Promise<void> {
  await TestDataSource.query(
    `CREATE OR REPLACE FUNCTION "public"."fn_enqueue_risk_job_for_credit_application"()
     RETURNS TRIGGER
     AS $$
BEGIN
  INSERT INTO "async_jobs" ("tenant_id", "type", "payload", "status", "attempts")
  VALUES (
    NEW."tenant_id",
    'RISK_EVAL',
    jsonb_build_object('applicationId', NEW."id"::text),
    'PENDING',
    0
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;`,
  );

  await TestDataSource.query(
    `DROP TRIGGER IF EXISTS "trg_credit_applications_enqueue_risk_job" ON "credit_applications";`,
  );

  await TestDataSource.query(
    `CREATE TRIGGER "trg_credit_applications_enqueue_risk_job"
     AFTER INSERT ON "credit_applications"
     FOR EACH ROW
     EXECUTE FUNCTION "public"."fn_enqueue_risk_job_for_credit_application"();`,
  );
}

describe('async_jobs trigger', () => {
  let asyncJobsRepo: Repository<AsyncJob>;
  let creditApplicationsRepo: Repository<CreditApplication>;
  let tenantFactory: TenantFactory;
  let countryFactory: CountryFactory;

  beforeEach(async () => {
    await ensureRiskEnqueueTrigger();
    asyncJobsRepo = TestDataSource.getRepository(AsyncJob);
    creditApplicationsRepo = TestDataSource.getRepository(CreditApplication);
    tenantFactory = new TenantFactory(TestDataSource);
    countryFactory = new CountryFactory(TestDataSource);
  });

  it('enqueues a PENDING RISK_EVAL job after credit application insert', async () => {
    // Arrange
    const tenant = await tenantFactory.create();
    const country = await countryFactory.create({
      status: COUNTRY_STATUS.ACTIVE,
      code: 'ES',
    });

    // Act
    const application = await creditApplicationsRepo.save(
      creditApplicationsRepo.create({
        tenantId: tenant.id,
        createdBy: '00000000-0000-0000-0000-000000000001',
        countryId: country.id,
        fullName: 'Jane Doe',
        documentId: 'DOC-123',
        monthlyIncome: 1000,
        requestedAmount: 500,
        status: CREDIT_APPLICATION_STATUS.PENDING,
        bankInfo: null,
      }),
    );

    const job = await asyncJobsRepo.findOne({
      where: { tenantId: tenant.id, type: ASYNC_JOB_TYPE.RISK_EVAL },
      order: { createdAt: 'DESC' },
    });

    // Assert
    expect(job).not.toBeNull();
    expect(job?.status).toBe(ASYNC_JOB_STATUS.PENDING);
    expect(job?.payload).toMatchObject({ applicationId: application.id });
  });
});

