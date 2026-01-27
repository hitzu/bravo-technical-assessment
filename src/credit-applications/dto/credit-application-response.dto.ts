import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import type { CreditApplication } from '../entities/credit-applications.entity';
import type { ApplicationRiskResult } from '../entities/application-risk-result.entity';
import type { ASYNC_JOB_STATUS } from '../../async-jobs/types/async-job-status.type';
import { CREDIT_APPLICATION_STATUS } from '../../common/types/credit-application-status.type';
import { ApplicationRiskResultSummaryDto } from './application-risk-result-summary.dto';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { RiskEvalJobSummaryDto } from './risk-eval-job-summary.dto';

export class CreditApplicationResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Unique application identifier',
    example: '0d3a3e64-3af4-46c4-9e2d-56c1920fd5a9',
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: 'Tenant identifier',
    example: '5b8c2a0e-64c1-4b33-8d66-1b4d7b7bf69a',
  })
  tenantId: string;

  @Expose()
  @ApiProperty({
    description: 'User id that created the application',
    example: '4afda5dd-5e25-4ea3-ba06-c5a2a608dbd2',
  })
  createdBy: string;

  @Expose()
  @ApiProperty({
    description: 'Country identifier (UUID)',
    example: '0d3a3e64-3af4-46c4-9e2d-56c1920fd5a9',
  })
  countryId: string;

  @Expose()
  @ApiProperty({
    description: 'Applicant full name',
    example: 'Juan Pérez',
  })
  fullName: string;

  @Expose()
  @ApiProperty({
    description: 'Applicant document identifier',
    example: 'XEXX010101000',
  })
  documentId: string;

  @Expose()
  @ApiProperty({
    description: 'Applicant monthly income',
    example: 25000,
  })
  monthlyIncome: number;

  @Expose()
  @ApiProperty({
    description: 'Requested credit amount',
    example: 100000,
  })
  requestedAmount: number;

  @Expose()
  @ApiProperty({
    description: 'Application status',
    enum: CREDIT_APPLICATION_STATUS,
    example: CREDIT_APPLICATION_STATUS.PENDING,
  })
  status: CREDIT_APPLICATION_STATUS;

  @Expose()
  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Bank info (mock payload later)',
    example: { bank: 'FakeBank', account: '****1234' },
  })
  bankInfo?: Record<string, unknown> | null;

  @Expose()
  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Latest risk evaluation result',
    type: ApplicationRiskResultSummaryDto,
  })
  riskResult?: ApplicationRiskResultSummaryDto | null;

  @Expose()
  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Latest risk evaluation async job metadata (when applicable)',
    type: RiskEvalJobSummaryDto,
  })
  riskEvalJob?: RiskEvalJobSummaryDto | null;

  @Expose()
  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-01-17T00:00:00.000Z',
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-01-17T00:00:00.000Z',
  })
  updatedAt: Date;

  @Expose()
  @ApiProperty({
    description: 'User that created the application',
    type: UserResponseDto,
  })
  user: UserResponseDto;

  constructor(
    application: CreditApplication,
    riskResult?: ApplicationRiskResult | null,
    riskEvalJob?: { status: ASYNC_JOB_STATUS; attempts: number; lastError: string | null } | null,
  ) {
    this.id = application.id;
    this.tenantId = application.tenantId;
    this.createdBy = application.createdBy;
    this.countryId = application.countryId;
    this.fullName = application.fullName;
    this.documentId = application.documentId;
    this.monthlyIncome = application.monthlyIncome;
    this.requestedAmount = application.requestedAmount;
    this.status = application.status;
    this.bankInfo = application.bankInfo ?? null;
    this.riskResult = riskResult
      ? new ApplicationRiskResultSummaryDto({
        decision: riskResult.decision,
        riskScore: riskResult.riskScore,
        debtToIncomeRatio: riskResult.debtToIncomeRatio,
      })
      : null;
    this.riskEvalJob = riskEvalJob ? new RiskEvalJobSummaryDto(riskEvalJob) : null;
    this.createdAt = application.createdAt;
    this.updatedAt = application.updatedAt;
    this.user = new UserResponseDto(application.user);
  }
}

