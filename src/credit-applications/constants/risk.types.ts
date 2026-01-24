export interface BankSnapshot {
  countryCode: string;
  provider: string;
  monthlyIncome: number;
  totalDebt: number;
  productsCount: number;
  generatedAt: string;
  [key: string]: unknown;
}

export enum APPLICATION_RISK_DECISION {
  APPROVE = 'APPROVE',
  REVIEW = 'REVIEW',
  REJECT = 'REJECT',
}

export type RiskDecision =
  (typeof APPLICATION_RISK_DECISION)[keyof typeof APPLICATION_RISK_DECISION];

export interface RiskEvaluationResult {
  riskScore: number;
  decision: RiskDecision;
  debtToIncomeRatio: number;
  rawBankSnapshot: BankSnapshot;
}

