import { Injectable } from '@nestjs/common';

import { APPLICATION_RISK_DECISION } from '../constants/risk.types';
import type { RiskEvaluationStrategy } from './risk-evaluation-strategy.interface';
import { computeRiskScore, safeDebtToIncomeRatio } from './risk-math';

function safeRequestedAmountToMonthlyIncomeRatio(
  requestedAmount: number,
  monthlyIncome: number,
): number {
  if (!Number.isFinite(requestedAmount) || requestedAmount < 0) return 9999;
  if (!Number.isFinite(monthlyIncome) || monthlyIncome <= 0) return 9999;
  const ratio = requestedAmount / monthlyIncome;
  return Number.isFinite(ratio) ? ratio : 9999;
}

@Injectable()
export class DefaultRiskStrategy implements RiskEvaluationStrategy {
  readonly countryCode = '*';

  evaluate({ application, bankSnapshot }: Parameters<RiskEvaluationStrategy['evaluate']>[0]) {
    const debtToIncomeRatio = safeDebtToIncomeRatio(
      bankSnapshot.totalDebt,
      bankSnapshot.monthlyIncome,
    );
    const requestedAmountToMonthlyIncomeRatio = safeRequestedAmountToMonthlyIncomeRatio(
      application.requestedAmount,
      application.monthlyIncome,
    );

    return {
      debtToIncomeRatio,
      requestedAmountToMonthlyIncomeRatio,
      decision: APPLICATION_RISK_DECISION.REVIEW,
      riskScore: computeRiskScore(debtToIncomeRatio),
      rawBankSnapshot: bankSnapshot,
    };
  }
}

