import type { CountryRule } from '../../countries/entities/country-rule.entity';
import type { BankSnapshot, RiskEvaluationResult } from '../constants/risk.types';
import type { CreditApplication } from '../entities/credit-applications.entity';

export interface RiskEvaluationStrategy {
  readonly countryCode: string;

  evaluate(params: {
    application: CreditApplication;
    bankSnapshot: BankSnapshot;
    countryRule: CountryRule | null;
  }): RiskEvaluationResult;
}

