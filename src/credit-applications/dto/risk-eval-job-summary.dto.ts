import { ApiProperty } from '@nestjs/swagger';

import { ASYNC_JOB_STATUS } from '../../async-jobs/types/async-job-status.type';

export class RiskEvalJobSummaryDto {
  @ApiProperty({
    description: 'Async job status',
    enum: ASYNC_JOB_STATUS,
    example: ASYNC_JOB_STATUS.DLQ,
  })
  status!: ASYNC_JOB_STATUS;

  @ApiProperty({
    description: 'Number of attempts performed by the job processor',
    example: 2,
  })
  attempts!: number;

  @ApiProperty({
    description: 'Last processing error (if any)',
    required: false,
    nullable: true,
    example: 'Force risk failure',
  })
  lastError!: string | null;

  constructor(data: { status: ASYNC_JOB_STATUS; attempts: number; lastError: string | null }) {
    this.status = data.status;
    this.attempts = data.attempts;
    this.lastError = data.lastError;
  }
}

