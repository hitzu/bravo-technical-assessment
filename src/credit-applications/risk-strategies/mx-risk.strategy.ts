import { Injectable } from '@nestjs/common';

import { APPLICATION_RISK_DECISION } from '../constants/risk.types';
import type { RiskEvaluationStrategy } from './risk-evaluation-strategy.interface';
import {
  computeRiskScore,
  RiskSeverity,
  safeDebtToIncomeRatio,
  worstSeverity,
} from './risk-math';

function safeRequestedAmountToMonthlyIncomeRatio(
  requestedAmount: number,
  monthlyIncome: number,
): number {
  if (!Number.isFinite(requestedAmount) || requestedAmount < 0) return Number.POSITIVE_INFINITY;
  if (!Number.isFinite(monthlyIncome) || monthlyIncome <= 0) return Number.POSITIVE_INFINITY;
  return requestedAmount / monthlyIncome;
}

@Injectable()
export class MxRiskStrategy implements RiskEvaluationStrategy {
  readonly countryCode = 'MX';

  evaluate({ application, bankSnapshot, countryRule }: Parameters<RiskEvaluationStrategy['evaluate']>[0]) {
    const debtToIncomeRatio = safeDebtToIncomeRatio(
      bankSnapshot.totalDebt,
      bankSnapshot.monthlyIncome,
    );

    const dtiApproveMax = countryRule?.dtiApproveMax ?? 0.25;
    const dtiReviewMax = countryRule?.dtiReviewMax ?? 0.55;
    const dtiSeverity: RiskSeverity =
      debtToIncomeRatio < dtiApproveMax
        ? RiskSeverity.APPROVE
        : debtToIncomeRatio <= dtiReviewMax
          ? RiskSeverity.REVIEW
          : RiskSeverity.REJECT;

    const requestedAmountToIncomeRatio = safeRequestedAmountToMonthlyIncomeRatio(
      application.requestedAmount,
      application.monthlyIncome,
    );
    const approveMax = countryRule?.requestedAmountToMonthlyIncomeApproveMax ?? 6;
    const reviewMax = countryRule?.requestedAmountToMonthlyIncomeReviewMax ?? 12;
    const amountSeverity: RiskSeverity =
      requestedAmountToIncomeRatio <= approveMax
        ? RiskSeverity.APPROVE
        : requestedAmountToIncomeRatio <= reviewMax
          ? RiskSeverity.REVIEW
          : RiskSeverity.REJECT;

    const severity = worstSeverity(dtiSeverity, amountSeverity);
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

