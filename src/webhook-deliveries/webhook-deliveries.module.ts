import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CreditApplication } from '../credit-applications/entities/credit-applications.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookDeliveriesController } from './webhook-deliveries.controller';
import { WebhookDeliveriesService } from './webhook-deliveries.service';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookDelivery, CreditApplication])],
  controllers: [WebhookDeliveriesController],
  providers: [WebhookDeliveriesService],
  exports: [WebhookDeliveriesService],
})
export class WebhookDeliveriesModule { }

