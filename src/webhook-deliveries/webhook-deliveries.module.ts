import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CacheModule } from '../cache/cache.module';
import { CreditApplication } from '../credit-applications/entities/credit-applications.entity';
import { ApplicationRiskResult } from '../credit-applications/entities/application-risk-result.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookDeliveriesController } from './webhook-deliveries.controller';
import { WebhookDeliveriesService } from './webhook-deliveries.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookDelivery, CreditApplication, ApplicationRiskResult]),
    CacheModule,
  ],
  controllers: [WebhookDeliveriesController],
  providers: [WebhookDeliveriesService],
  exports: [WebhookDeliveriesService],
})
export class WebhookDeliveriesModule { }

