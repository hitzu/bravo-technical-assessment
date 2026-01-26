import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { FindOptionsWhere, Repository } from 'typeorm';

import type { CachePort } from '../cache/cache.port';
import { CACHE_PORT } from '../cache/cache.port';
import { CREDIT_APPLICATION_STATUS } from '../common/types/credit-application-status.type';
import { CreditApplication } from '../credit-applications/entities/credit-applications.entity';
import {
  WEBHOOK_DELIVERY_STATUS,
  WEBHOOK_DELIVERY_TYPE,
  WebhookDelivery,
} from './entities/webhook-delivery.entity';

@Injectable()
export class WebhookDeliveriesService {
  private readonly logger = new Logger(WebhookDeliveriesService.name);

  constructor(
    @InjectRepository(WebhookDelivery)
    private readonly webhookDeliveriesRepository: Repository<WebhookDelivery>,
    @InjectRepository(CreditApplication)
    private readonly creditApplicationsRepository: Repository<CreditApplication>,
    @Inject(CACHE_PORT)
    private readonly cache: CachePort,
  ) { }

  async createRiskResultDelivery(params: {
    tenantId: string;
    applicationId: string;
    url: string;
    payload: unknown;
    headers?: Record<string, unknown>;
  }): Promise<WebhookDelivery> {
    const delivery = this.webhookDeliveriesRepository.create({
      tenantId: params.tenantId,
      applicationId: params.applicationId,
      url: params.url,
      type: WEBHOOK_DELIVERY_TYPE.RISK_RESULT,
      status: WEBHOOK_DELIVERY_STATUS.PENDING,
      requestBody: params.payload,
      requestHeaders: params.headers ?? null,
      attemptCount: 0,
      idempotencyKey: null,
      responseStatusCode: null,
      responseBody: null,
      errorMessage: null,
      deliveredAt: null,
    });

    const saved = await this.webhookDeliveriesRepository.save(delivery);
    this.logger.log(
      { deliveryId: saved.id, tenantId: saved.tenantId, applicationId: saved.applicationId },
      'Webhook delivery created',
    );
    return saved;
  }

  async createRiskResultDeliveryForApplication(params: {
    applicationId: string;
    url: string;
    payload: unknown;
    headers?: Record<string, unknown>;
  }): Promise<WebhookDelivery> {
    const application = await this.creditApplicationsRepository.findOne({
      where: { id: params.applicationId },
    });

    if (!application) {
      throw new NotFoundException('Credit application not found');
    }

    return this.createRiskResultDelivery({
      tenantId: application.tenantId,
      applicationId: application.id,
      url: params.url,
      payload: params.payload,
      headers: params.headers,
    });
  }

  async markDeliverySuccess(params: {
    deliveryId: string;
    responseStatusCode: number;
    responseBody?: unknown;
  }): Promise<WebhookDelivery> {
    const delivery = await this.webhookDeliveriesRepository.findOne({
      where: { id: params.deliveryId },
    });

    if (!delivery) {
      throw new NotFoundException('Webhook delivery not found');
    }

    delivery.status = WEBHOOK_DELIVERY_STATUS.SUCCESS;
    delivery.responseStatusCode = params.responseStatusCode;
    delivery.responseBody = params.responseBody ?? null;
    delivery.errorMessage = null;
    delivery.attemptCount = delivery.attemptCount + 1;
    delivery.deliveredAt = new Date();

    return this.webhookDeliveriesRepository.save(delivery);
  }

  async updateApplicationStatus(params: {
    applicationId: string;
    status: CREDIT_APPLICATION_STATUS;
  }): Promise<void> {
    const application = await this.creditApplicationsRepository.findOne({
      where: { id: params.applicationId },
    });

    if (!application) {
      throw new NotFoundException('Credit application not found');
    }

    application.status = params.status;
    const updated = await this.creditApplicationsRepository.save(application);
    this.cache.del(`application:${updated.tenantId}:${updated.id}`);
  }

  async listDeliveries(params?: {
    tenantId?: string;
    applicationId?: string;
    type?: WEBHOOK_DELIVERY_TYPE;
    status?: WEBHOOK_DELIVERY_STATUS;
    take?: number;
  }): Promise<WebhookDelivery[]> {
    const where: FindOptionsWhere<WebhookDelivery> = {};
    if (params?.tenantId) {
      where.tenantId = params.tenantId;
    }
    if (params?.applicationId) {
      where.applicationId = params.applicationId;
    }
    if (params?.type) {
      where.type = params.type;
    }
    if (params?.status) {
      where.status = params.status;
    }

    return this.webhookDeliveriesRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: params?.take ?? 100,
    });
  }

  async getDeliveryById(id: string): Promise<WebhookDelivery | null> {
    return this.webhookDeliveriesRepository.findOne({ where: { id } });
  }
}

