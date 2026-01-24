import { ApiProperty } from '@nestjs/swagger';

import { APPLICATION_RISK_DECISION } from '../constants/risk.types';

export class ApplicationRiskResultSummaryDto {
  @ApiProperty({
    description: 'Risk decision for this application',
    enum: APPLICATION_RISK_DECISION,
    example: APPLICATION_RISK_DECISION.REVIEW,
  })
  decision: APPLICATION_RISK_DECISION;

  @ApiProperty({
    description: 'Risk score (0-100)',
    example: 72,
    minimum: 0,
    maximum: 100,
  })
  riskScore: number;

  @ApiProperty({
    description: 'Debt-to-income ratio computed from bank snapshot',
    example: 0.42,
  })
  debtToIncomeRatio: number;

  constructor(params: {
    decision: APPLICATION_RISK_DECISION;
    riskScore: number;
    debtToIncomeRatio: number;
  }) {
    this.decision = params.decision;
    this.riskScore = params.riskScore;
    this.debtToIncomeRatio = params.debtToIncomeRatio;
  }
}

