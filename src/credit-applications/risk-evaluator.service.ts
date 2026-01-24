import { Injectable } from '@nestjs/common';

import type { BankSnapshot, RiskEvaluationResult } from './constants/risk.types';
import type { CountryRule } from '../countries/entities/country-rule.entity';
import type { CreditApplication } from './entities/credit-applications.entity';
import { RiskStrategyRegistryService } from './risk-strategies/risk-strategy-registry.service';

@Injectable()
export class RiskEvaluatorService {
  constructor(
    private readonly riskStrategyRegistryService: RiskStrategyRegistryService,
  ) { }

  evaluateRisk(
    countryCode: string,
    application: CreditApplication,
    bankSnapshot: BankSnapshot,
    countryRule: CountryRule | null = null,
  ): RiskEvaluationResult {
    const strategy = this.riskStrategyRegistryService.resolve(countryCode);
    return strategy.evaluate({ application, bankSnapshot, countryRule });
  }
}

