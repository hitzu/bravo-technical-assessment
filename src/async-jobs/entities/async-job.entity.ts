import { Column, Entity, Index } from 'typeorm';

import { BaseTimeEntity } from '../../common/entities/base-time.entity';
import { ASYNC_JOB_STATUS } from '../types/async-job-status.type';
import { ASYNC_JOB_TYPE } from '../types/async-job-type.type';

export interface RiskEvalJobPayload {
  applicationId: string;
}

export type AsyncJobPayload = RiskEvalJobPayload;

@Entity({ name: 'async_jobs' })
@Index('ix_async_jobs_status_created', ['status', 'createdAt'])
@Index('ix_async_jobs_tenant_status', ['tenantId', 'status'])
export class AsyncJob extends BaseTimeEntity {
  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Column({
    type: 'enum',
    enum: ASYNC_JOB_TYPE,
    enumName: 'ASYNC_JOB_TYPE',
  })
  type!: ASYNC_JOB_TYPE;

  @Column('jsonb')
  payload!: AsyncJobPayload;

  @Column({
    type: 'enum',
    enum: ASYNC_JOB_STATUS,
    enumName: 'ASYNC_JOB_STATUS',
    default: ASYNC_JOB_STATUS.PENDING,
  })
  status!: ASYNC_JOB_STATUS;

  @Column('int', { default: 0 })
  attempts!: number;

  @Column('text', { name: 'last_error', nullable: true })
  lastError!: string | null;

  @Column('timestamptz', { name: 'processed_at', nullable: true })
  processedAt!: Date | null;
}

