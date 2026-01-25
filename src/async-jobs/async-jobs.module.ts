import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreditApplicationsModule } from '../credit-applications/credit-applications.module';
import { ApplicationRiskResult } from '../credit-applications/entities/application-risk-result.entity';
import { CreditApplication } from '../credit-applications/entities/credit-applications.entity';
import { WebhookDeliveriesModule } from '../webhook-deliveries/webhook-deliveries.module';
import { AsyncJobsController } from './async-jobs.controller';
import { AsyncJobsCronService } from './async-jobs.cron.service';
import { AsyncJobsProcessorService } from './async-jobs-processor.service';
import { AsyncJob } from './entities/async-job.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AsyncJob, CreditApplication, ApplicationRiskResult]),
    CreditApplicationsModule,
    WebhookDeliveriesModule,
  ],
  controllers: [AsyncJobsController],
  providers: [AsyncJobsProcessorService, AsyncJobsCronService],
  exports: [AsyncJobsProcessorService],
})
export class AsyncJobsModule { }

