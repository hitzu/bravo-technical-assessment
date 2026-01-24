import { Injectable } from '@nestjs/common';

import { APPLICATION_RISK_DECISION } from '../constants/risk.types';
import type { RiskEvaluationStrategy } from './risk-evaluation-strategy.interface';
import { computeRiskScore, RiskSeverity, safeDebtToIncomeRatio } from './risk-math';

@Injectable()
export class EsRiskStrategy implements RiskEvaluationStrategy {
  readonly countryCode = 'ES';

  evaluate({ application, bankSnapshot, countryRule }: Parameters<RiskEvaluationStrategy['evaluate']>[0]) {
    const debtToIncomeRatio = safeDebtToIncomeRatio(
      bankSnapshot.totalDebt,
      bankSnapshot.monthlyIncome,
    );

    const approveMax = countryRule?.dtiApproveMax ?? 0.3;
    const reviewMax = countryRule?.dtiReviewMax ?? 0.6;

    let severity: RiskSeverity =
      debtToIncomeRatio < approveMax
        ? RiskSeverity.APPROVE
        : debtToIncomeRatio <= reviewMax
          ? RiskSeverity.REVIEW
          : RiskSeverity.REJECT;

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
      decision,
      riskScore: computeRiskScore(debtToIncomeRatio),
      rawBankSnapshot: bankSnapshot,
    };
  }
}

