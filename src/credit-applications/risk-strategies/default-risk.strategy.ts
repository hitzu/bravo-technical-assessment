import { Injectable } from '@nestjs/common';

import { APPLICATION_RISK_DECISION } from '../constants/risk.types';
import type { RiskEvaluationStrategy } from './risk-evaluation-strategy.interface';
import { computeRiskScore, safeDebtToIncomeRatio } from './risk-math';

@Injectable()
export class DefaultRiskStrategy implements RiskEvaluationStrategy {
  readonly countryCode = '*';

  evaluate({ application, bankSnapshot }: Parameters<RiskEvaluationStrategy['evaluate']>[0]) {
    void application;
    const debtToIncomeRatio = safeDebtToIncomeRatio(
      bankSnapshot.totalDebt,
      bankSnapshot.monthlyIncome,
    );

    return {
      debtToIncomeRatio,
      decision: APPLICATION_RISK_DECISION.REVIEW,
      riskScore: computeRiskScore(debtToIncomeRatio),
      rawBankSnapshot: bankSnapshot,
    };
  }
}

