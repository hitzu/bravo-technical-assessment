export function safeDebtToIncomeRatio(totalDebt: number, monthlyIncome: number): number {
  if (!Number.isFinite(totalDebt) || totalDebt < 0) return 1;
  if (!Number.isFinite(monthlyIncome) || monthlyIncome <= 0) return 1;
  return totalDebt / monthlyIncome;
}

export function computeRiskScore(debtToIncomeRatio: number): number {
  const ratio = Number.isFinite(debtToIncomeRatio) ? debtToIncomeRatio : 1;
  const score = Math.round(100 - ratio * 100);
  return Math.max(0, Math.min(100, score));
}

export enum RiskSeverity {
  APPROVE = 0,
  REVIEW = 1,
  REJECT = 2,
}

export function worstSeverity(a: RiskSeverity, b: RiskSeverity): RiskSeverity {
  return a > b ? a : b;
}

