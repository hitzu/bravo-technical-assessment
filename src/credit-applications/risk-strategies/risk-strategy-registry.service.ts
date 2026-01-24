import { Injectable } from '@nestjs/common';

import { DefaultRiskStrategy } from './default-risk.strategy';
import { EsRiskStrategy } from './es-risk.strategy';
import { MxRiskStrategy } from './mx-risk.strategy';
import type { RiskEvaluationStrategy } from './risk-evaluation-strategy.interface';

@Injectable()
export class RiskStrategyRegistryService {
  private readonly strategies: Record<string, RiskEvaluationStrategy>;

  constructor(
    private readonly es: EsRiskStrategy,
    private readonly mx: MxRiskStrategy,
    private readonly fallback: DefaultRiskStrategy,
  ) {
    this.strategies = {
      [this.es.countryCode]: this.es,
      [this.mx.countryCode]: this.mx,
    };
  }

  resolve(countryCode: string): RiskEvaluationStrategy {
    const normalized = countryCode.trim().toUpperCase();
    return this.strategies[normalized] ?? this.fallback;
  }
}

