import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '../auth/decorators/public.decorator';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { CREDIT_APPLICATION_STATUS } from '../common/types/credit-application-status.type';
import { APPLICATION_RISK_DECISION } from '../credit-applications/constants/risk.types';
import type {
  WEBHOOK_DELIVERY_STATUS,
  WEBHOOK_DELIVERY_TYPE,
} from './entities/webhook-delivery.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookDeliveriesService } from './webhook-deliveries.service';

function mapDecisionToStatus(decision: unknown): CREDIT_APPLICATION_STATUS {
  switch (decision) {
    case APPLICATION_RISK_DECISION.APPROVE:
      return CREDIT_APPLICATION_STATUS.APPROVED;
    case APPLICATION_RISK_DECISION.REJECT:
      return CREDIT_APPLICATION_STATUS.REJECTED;
    case APPLICATION_RISK_DECISION.REVIEW:
      return CREDIT_APPLICATION_STATUS.IN_REVIEW;
    default:
      return CREDIT_APPLICATION_STATUS.ERROR;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@ApiTags('WebhookDeliveries')
@Controller()
export class WebhookDeliveriesController {
  constructor(private readonly webhookDeliveriesService: WebhookDeliveriesService) { }

  @Post('mock/partner/webhooks/applications/:applicationId/risk-updated')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mock partner endpoint to receive risk webhook' })
  @ApiParam({ name: 'applicationId', type: 'string' })
  @ApiOkResponse({ type: WebhookDelivery })
  async mockPartnerRiskUpdated(
    @Param('applicationId', new ParseUUIDPipe()) applicationId: string,
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<WebhookDelivery> {
    const url = `/mock/partner/webhooks/applications/${applicationId}/risk-updated`;
    const headerSnapshot: Record<string, unknown> = {
      'content-type': headers['content-type'],
      'user-agent': headers['user-agent'],
      'x-idempotency-key': headers['x-idempotency-key'],
      'x-request-id': headers['x-request-id'],
    };

    const created = await this.webhookDeliveriesService.createRiskResultDeliveryForApplication({
      applicationId,
      url,
      payload,
      headers: headerSnapshot,
    });

    const riskResult = payload['riskResult'];
    const decision = isRecord(riskResult) ? riskResult['decision'] : undefined;
    await this.webhookDeliveriesService.updateApplicationStatus({
      applicationId,
      status: mapDecisionToStatus(decision),
    });

    return this.webhookDeliveriesService.markDeliverySuccess({
      deliveryId: created.id,
      responseStatusCode: 200,
      responseBody: { ok: true },
    });
  }

  @Get('webhook-deliveries')
  @UseGuards(AdminRoleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List webhook deliveries (admin debug)' })
  @ApiOkResponse({ type: [WebhookDelivery] })
  async list(
    @Query('tenantId') tenantId?: string,
    @Query('applicationId') applicationId?: string,
    @Query('type') type?: WEBHOOK_DELIVERY_TYPE,
    @Query('status') status?: WEBHOOK_DELIVERY_STATUS,
  ): Promise<WebhookDelivery[]> {
    return this.webhookDeliveriesService.listDeliveries({
      tenantId,
      applicationId,
      type,
      status,
    });
  }

  @Get('webhook-deliveries/:id')
  @UseGuards(AdminRoleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get webhook delivery by id (admin debug)' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ type: WebhookDelivery })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<WebhookDelivery> {
    const delivery = await this.webhookDeliveriesService.getDeliveryById(id);
    if (!delivery) {
      throw new NotFoundException('Webhook delivery not found');
    }
    return delivery;
  }
}

