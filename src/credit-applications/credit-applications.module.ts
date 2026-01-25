import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CacheModule } from '../cache/cache.module';
import { Country } from '../countries/entities/country.entity';
import { CountryRule } from '../countries/entities/country-rule.entity';
import { CreditApplicationsController } from './credit-applications.controller';
import { BankProviderRegistryService } from './bank-providers/bank-provider-registry.service';
import { CreditApplicationRiskService } from './credit-application-risk.service';
import { CreditApplication } from './entities/credit-applications.entity';
import { ApplicationRiskResult } from './entities/application-risk-result.entity';
import { CreditApplicationsService } from './credit-applications.service';
import { RiskEvaluatorService } from './risk-evaluator.service';
import { DefaultRiskStrategy } from './risk-strategies/default-risk.strategy';
import { EsRiskStrategy } from './risk-strategies/es-risk.strategy';
import { MxRiskStrategy } from './risk-strategies/mx-risk.strategy';
import { RiskStrategyRegistryService } from './risk-strategies/risk-strategy-registry.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CreditApplication,
      ApplicationRiskResult,
      Country,
      CountryRule,
    ]),
    CacheModule,
  ],
  controllers: [CreditApplicationsController],
  providers: [
    CreditApplicationsService,
    CreditApplicationRiskService,
    BankProviderRegistryService,
    RiskEvaluatorService,
    RiskStrategyRegistryService,
    EsRiskStrategy,
    MxRiskStrategy,
    DefaultRiskStrategy,
  ],
  exports: [CreditApplicationRiskService],
})
export class CreditApplicationsModule { }

