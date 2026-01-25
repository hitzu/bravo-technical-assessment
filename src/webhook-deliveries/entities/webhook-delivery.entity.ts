import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import { CreditApplication } from '../../credit-applications/entities/credit-applications.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

export enum WEBHOOK_DELIVERY_TYPE {
  RISK_RESULT = 'RISK_RESULT',
}

export enum WEBHOOK_DELIVERY_STATUS {
  PENDING = 'PENDING',
  SENT = 'SENT',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity({ name: 'webhook_deliveries' })
@Index('ix_webhook_deliveries_tenant_application', ['tenantId', 'applicationId'])
@Index('ix_webhook_deliveries_tenant_type_status', ['tenantId', 'type', 'status'])
export class WebhookDelivery extends BaseTimeEntity {
  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column('uuid', { name: 'application_id' })
  applicationId!: string;

  @Column({
    type: 'enum',
    enum: WEBHOOK_DELIVERY_TYPE,
    enumName: 'WEBHOOK_DELIVERY_TYPE',
  })
  type!: WEBHOOK_DELIVERY_TYPE;

  @Column({
    type: 'enum',
    enum: WEBHOOK_DELIVERY_STATUS,
    enumName: 'WEBHOOK_DELIVERY_STATUS',
    default: WEBHOOK_DELIVERY_STATUS.PENDING,
  })
  status!: WEBHOOK_DELIVERY_STATUS;

  @Column('varchar')
  url!: string;

  @Column('jsonb', { name: 'request_body' })
  requestBody!: unknown;

  @Column('jsonb', { name: 'request_headers', nullable: true })
  requestHeaders!: Record<string, unknown> | null;

  @Column('int', { name: 'response_status_code', nullable: true })
  responseStatusCode!: number | null;

  @Column('jsonb', { name: 'response_body', nullable: true })
  responseBody!: unknown | null;

  @Column('text', { name: 'error_message', nullable: true })
  errorMessage!: string | null;

  @Column('int', { name: 'attempt_count', default: 0 })
  attemptCount!: number;

  @Column('varchar', { name: 'idempotency_key', length: 128, nullable: true })
  idempotencyKey!: string | null;

  @Column('timestamptz', { name: 'delivered_at', nullable: true })
  deliveredAt!: Date | null;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @ManyToOne(() => CreditApplication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application!: CreditApplication;
}

