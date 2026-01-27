import { Injectable } from '@nestjs/common';

import { APPLICATION_RISK_DECISION } from '../constants/risk.types';
import type { RiskEvaluationStrategy } from './risk-evaluation-strategy.interface';
import { computeRiskScore, RiskSeverity, safeDebtToIncomeRatio } from './risk-math';

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
export class EsRiskStrategy implements RiskEvaluationStrategy {
  readonly countryCode = 'ES';

  /**
   * ES rules (simplified for the assessment):
   *
   * - DTI = totalDebt / bankMonthlyIncome
   *
   * - APPROVE if DTI < 0.30
   * - REVIEW if 0.30 <= DTI <= 0.60
   * - REJECT if DTI > 0.60
   *
   * Optional hook:
   * - If countryRule.requestedAmountReviewThreshold is set and requestedAmount exceeds it,
   *   downgrade APPROVE → REVIEW.
   */
  evaluate({ application, bankSnapshot, countryRule }: Parameters<RiskEvaluationStrategy['evaluate']>[0]) {
    const debtToIncomeRatio = safeDebtToIncomeRatio(
      bankSnapshot.totalDebt,
      bankSnapshot.monthlyIncome,
    );

    let severity: RiskSeverity =
      debtToIncomeRatio < 0.3
        ? RiskSeverity.APPROVE
        : debtToIncomeRatio > 0.6
          ? RiskSeverity.REJECT
          : RiskSeverity.REVIEW;

    const requestedAmountToMonthlyIncomeRatio = safeRequestedAmountToMonthlyIncomeRatio(
      application.requestedAmount,
      application.monthlyIncome,
    );

    const requestedAmountReviewThreshold: number | null =
      countryRule?.requestedAmountReviewThreshold ?? null;
    if (
      requestedAmountReviewThreshold !== null &&
      Number.isFinite(requestedAmountReviewThreshold) &&
      application.requestedAmount > requestedAmountReviewThreshold &&
      severity === RiskSeverity.APPROVE
    ) {
      severity = RiskSeverity.REVIEW;
    }

    const decision =
      severity === RiskSeverity.APPROVE
        ? APPLICATION_RISK_DECISION.APPROVE
        : severity === RiskSeverity.REVIEW
          ? APPLICATION_RISK_DECISION.REVIEW
          : APPLICATION_RISK_DECISION.REJECT;

    return {
      debtToIncomeRatio,
      requestedAmountToMonthlyIncomeRatio,
      decision,
      riskScore: computeRiskScore(debtToIncomeRatio),
      rawBankSnapshot: bankSnapshot,
    };
  }
}
