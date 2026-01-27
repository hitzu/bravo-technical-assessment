import { Injectable } from '@nestjs/common';

import { APPLICATION_RISK_DECISION } from '../constants/risk.types';
import type { RiskEvaluationStrategy } from './risk-evaluation-strategy.interface';
import {
  RiskSeverity,
  computeRiskScore,
  safeDebtToIncomeRatio,
  worstSeverity,
} from './risk-math';

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
export class MxRiskStrategy implements RiskEvaluationStrategy {
  readonly countryCode = 'MX';

  /**
   * MX rules (simplified for the assessment):
   *
   * - DTI = totalDebt / bankMonthlyIncome
   * - requestedRatio = requestedAmount / declaredMonthlyIncome
   *
   * DTI thresholds:
   * - APPROVE if DTI < 0.25
   * - REJECT if DTI > 0.60
   * - Otherwise REVIEW
   *
   * requestedRatio thresholds:
   * - APPROVE if requestedRatio <= 0.30
   * - REVIEW if 0.30 < requestedRatio <= 0.80
   * - REJECT if requestedRatio > 0.80
   *
   * Final decision uses the worst severity across both ratios.
   */
  evaluate({ application, bankSnapshot, countryRule }: Parameters<RiskEvaluationStrategy['evaluate']>[0]) {
    void countryRule;
    const debtToIncomeRatio = safeDebtToIncomeRatio(
      bankSnapshot.totalDebt,
      bankSnapshot.monthlyIncome,
    );

    const dtiSeverity: RiskSeverity =
      debtToIncomeRatio < 0.25
        ? RiskSeverity.APPROVE
        : debtToIncomeRatio > 0.6
          ? RiskSeverity.REJECT
          : RiskSeverity.REVIEW;

    const requestedAmountToMonthlyIncomeRatio = safeRequestedAmountToMonthlyIncomeRatio(
      application.requestedAmount,
      application.monthlyIncome,
    );
    const amountSeverity: RiskSeverity =
      requestedAmountToMonthlyIncomeRatio <= 0.3
        ? RiskSeverity.APPROVE
        : requestedAmountToMonthlyIncomeRatio > 0.8
          ? RiskSeverity.REJECT
          : RiskSeverity.REVIEW;

    const severity = worstSeverity(dtiSeverity, amountSeverity);
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

