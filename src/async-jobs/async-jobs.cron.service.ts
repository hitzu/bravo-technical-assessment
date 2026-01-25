import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AsyncJobsProcessorService } from './async-jobs-processor.service';

@Injectable()
export class AsyncJobsCronService {
  private readonly logger = new Logger(AsyncJobsCronService.name);

  private isRunning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly asyncJobsProcessorService: AsyncJobsProcessorService,
  ) { }

  @Cron(CronExpression.EVERY_SECOND)
  async processAsyncJobsEverySecond(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const limit = this.getLimit();
      const result = await this.asyncJobsProcessorService.processPendingJobs(limit);
      if (result.processed > 0 || result.dlq > 0) {
        this.logger.log(
          { processed: result.processed, dlq: result.dlq },
          'Async jobs cron processed jobs',
        );
      }
    } catch (error) {
      const safeError = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: safeError }, 'Async jobs cron tick failed');
    } finally {
      this.isRunning = false;
    }
  }

  private isEnabled(): boolean {
    const raw = this.configService.get<string>('ASYNC_JOBS_CRON_ENABLED');
    return raw === 'true';
  }

  private getLimit(): number {
    const raw = this.configService.get<string>('ASYNC_JOBS_CRON_LIMIT');
    if (!raw) {
      return 10;
    }

    const normalized = Number(raw);
    return Number.isFinite(normalized) && normalized > 0 ? Math.floor(normalized) : 10;
  }
}

