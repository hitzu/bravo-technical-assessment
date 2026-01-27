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

  @ApiProperty({
    description:
      'Requested amount to declared monthly income ratio (requestedAmount / monthlyIncome)',
    example: 0.1,
  })
  requestedAmountToMonthlyIncomeRatio: number;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Raw bank snapshot used for the evaluation (for reviewer context)',
    example: { monthlyIncome: 50000, totalDebt: 8000 },
  })
  rawBankSnapshot?: Record<string, unknown> | null;

  constructor(params: {
    decision: APPLICATION_RISK_DECISION;
    riskScore: number;
    debtToIncomeRatio: number;
    requestedAmountToMonthlyIncomeRatio: number;
    rawBankSnapshot?: Record<string, unknown> | null;
  }) {
    this.decision = params.decision;
    this.riskScore = params.riskScore;
    this.debtToIncomeRatio = params.debtToIncomeRatio;
    this.requestedAmountToMonthlyIncomeRatio = params.requestedAmountToMonthlyIncomeRatio;
    this.rawBankSnapshot = params.rawBankSnapshot ?? null;
  }
}

