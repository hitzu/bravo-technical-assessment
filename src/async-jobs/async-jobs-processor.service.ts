import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { CreditApplicationRiskService } from '../credit-applications/credit-application-risk.service';
import { ApplicationRiskResult } from '../credit-applications/entities/application-risk-result.entity';
import { CreditApplication } from '../credit-applications/entities/credit-applications.entity';
import { WebhookDeliveriesService } from '../webhook-deliveries/webhook-deliveries.service';
import { AsyncJob } from './entities/async-job.entity';
import { ASYNC_JOB_STATUS } from './types/async-job-status.type';
import { ASYNC_JOB_TYPE } from './types/async-job-type.type';
import { CREDIT_APPLICATION_STATUS } from '../common/types/credit-application-status.type';

const MAX_ATTEMPTS = 2;

type AsyncJobRow = {
  id: string;
  tenantId: string;
  type: ASYNC_JOB_TYPE;
  payload: unknown;
  status: ASYNC_JOB_STATUS;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  processedAt: Date | null;
  forceRiskFailure: boolean;
};

@Injectable()
export class AsyncJobsProcessorService {
  private readonly logger = new Logger(AsyncJobsProcessorService.name);

  constructor(
    @InjectRepository(AsyncJob)
    private readonly asyncJobsRepository: Repository<AsyncJob>,
    @InjectRepository(CreditApplication)
    private readonly creditApplicationsRepository: Repository<CreditApplication>,
    @InjectRepository(ApplicationRiskResult)
    private readonly applicationRiskResultsRepository: Repository<ApplicationRiskResult>,
    private readonly creditApplicationRiskService: CreditApplicationRiskService,
    private readonly webhookDeliveriesService: WebhookDeliveriesService,
  ) { }

  async processPendingJobs(
    limit = 10,
  ): Promise<{ processed: number; dlq: number }> {
    const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;

    const jobs = await this.fetchAndMarkJobsRunning(normalizedLimit);

    let processed = 0;
    let dlq = 0;

    for (const job of jobs) {
      const { outcome } = await this.processSingleJob(job);

      if (outcome === 'processed') {
        processed += 1;
      } else if (outcome === 'dlq') {
        dlq += 1;
      }
    }

    return { processed, dlq };
  }

  private async markJobDlq(jobId: string, lastError: string): Promise<void> {
    await this.asyncJobsRepository.update(
      { id: jobId },
      {
        status: ASYNC_JOB_STATUS.DLQ,
        lastError,
      },
    );
  }

  private async fetchAndMarkJobsRunning(limit: number): Promise<AsyncJobRow[]> {

    const rawResult = await this.asyncJobsRepository.query(
      `UPDATE "async_jobs"
       SET "status" = $1,
           "attempts" = "attempts" + 1,
           "updated_at" = now()
       WHERE "id" IN (
         SELECT "id"
         FROM "async_jobs"
         WHERE "status" = $2
         ORDER BY "created_at" ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $3::int
       )
       RETURNING
         "id",
         "tenant_id" as "tenantId",
         "type",
         "payload",
         "status",
         "attempts",
         "last_error" as "lastError",
         "created_at" as "createdAt",
         "updated_at" as "updatedAt",
         "deleted_at" as "deletedAt",
         "processed_at" as "processedAt";`,
      [ASYNC_JOB_STATUS.RUNNING, ASYNC_JOB_STATUS.PENDING, limit],
    );

    return (
      Array.isArray(rawResult) && Array.isArray(rawResult[0])
        ? (rawResult[0] as unknown[])
        : (rawResult as unknown[])
    ) as AsyncJobRow[];

  }

  private async processSingleJob(job: AsyncJobRow): Promise<{ outcome: 'processed' | 'dlq' | 'retry' }> {
    const { id: jobId, tenantId, type, payload, attempts } = job;

    try {
      if (!tenantId) {
        await this.markJobDlq(jobId, 'Invalid job row: missing tenantId');
        return { outcome: 'dlq' };
      }

      if (type !== ASYNC_JOB_TYPE.RISK_EVAL) {
        await this.markJobDlq(jobId, `Unsupported job type: ${type}`);
        return { outcome: 'dlq' };
      }

      const parsedPayload =
        typeof payload === 'string' ? JSON.parse(payload) : payload;

      const applicationId = (parsedPayload as { applicationId?: unknown })?.applicationId;
      if (typeof applicationId !== 'string' || applicationId.length === 0) {
        await this.markJobDlq(jobId, 'Invalid payload: missing applicationId');
        return { outcome: 'dlq' };
      }

      const application = await this.creditApplicationsRepository.findOne({
        where: { id: applicationId, tenantId },
      });

      if (!application) {
        await this.markJobDlq(jobId, 'Application not found');
        return { outcome: 'dlq' };
      }

      if (application.forceRiskFailure) {
        await this.creditApplicationsRepository.update(application.id, { status: CREDIT_APPLICATION_STATUS.ERROR });
        await this.markJobDlq(jobId, 'Force risk failure');
        return { outcome: 'dlq' };
      }

      const existingRiskResult =
        await this.applicationRiskResultsRepository.findOne({
          where: { tenantId, applicationId: application.id },
          order: { createdAt: 'DESC' },
        });

      const riskResult = existingRiskResult
        ? existingRiskResult
        : (await this.creditApplicationRiskService.evaluateAndPersistForApplication(
          tenantId,
          application.id,
        )).riskResult;

      const url = `http://localhost:3000/mock/partner/webhooks/applications/${application.id}/risk-updated`;
      const idempotencyKey = `risk-updated:${application.id}`;

      fetch(url, {
        method: 'POST',
        body: JSON.stringify({
          tenantId,
          applicationId: application.id,
          riskResult: {
            id: riskResult.id,
            createdAt: riskResult.createdAt,
            debtToIncomeRatio: riskResult.debtToIncomeRatio,
            riskScore: riskResult.riskScore,
            decision: riskResult.decision,
            rawBankSnapshot: riskResult.rawBankSnapshot,
          },
        }),
        headers: {
          'Content-Type': 'application/json',
          source: 'async_jobs',
          jobType: type,
          jobId,
          'x-idempotency-key': idempotencyKey,
        },
      });

      await this.asyncJobsRepository.update(
        { id: jobId },
        {
          status: ASYNC_JOB_STATUS.DONE,
          processedAt: new Date(),
          lastError: null,
        },
      );

      return { outcome: 'processed' };
    } catch (error) {
      const lastError = error instanceof Error ? error.message : String(error);
      this.logger.warn({ jobId, error: lastError, attempts }, 'Job processing failed');

      if (attempts >= MAX_ATTEMPTS) {
        await this.markJobDlq(jobId, lastError);
        return { outcome: 'dlq' };
      }

      await this.asyncJobsRepository.update(
        { id: jobId },
        {
          status: ASYNC_JOB_STATUS.PENDING,
          lastError,
        },
      );

      return { outcome: 'retry' };
    }
  }
}