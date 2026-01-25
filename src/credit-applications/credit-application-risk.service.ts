import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { CREDIT_APPLICATION_STATUS } from '../common/types/credit-application-status.type';
import { APPLICATION_RISK_DECISION } from './constants/risk.types';
import { BankProviderRegistryService } from './bank-providers/bank-provider-registry.service';
import { ApplicationRiskResult } from './entities/application-risk-result.entity';
import { CreditApplication } from './entities/credit-applications.entity';
import { RiskEvaluatorService } from './risk-evaluator.service';
import { Country } from '../countries/entities/country.entity';
import { CountryRule } from '../countries/entities/country-rule.entity';

@Injectable()
export class CreditApplicationRiskService {
  constructor(
    @InjectRepository(CreditApplication)
    private readonly creditApplicationsRepository: Repository<CreditApplication>,
    @InjectRepository(ApplicationRiskResult)
    private readonly applicationRiskResultsRepository: Repository<ApplicationRiskResult>,
    @InjectRepository(Country)
    private readonly countriesRepository: Repository<Country>,
    @InjectRepository(CountryRule)
    private readonly countryRulesRepository: Repository<CountryRule>,
    private readonly bankProviderRegistryService: BankProviderRegistryService,
    private readonly riskEvaluatorService: RiskEvaluatorService,
  ) { }

  async evaluateAndPersistForApplication(
    tenantId: string,
    applicationId: string,
  ): Promise<{
    application: CreditApplication;
    riskResult: ApplicationRiskResult;
  }> {
    return this.creditApplicationsRepository.manager.transaction(
      async (manager) => {
        const creditApplicationsRepository = manager.getRepository(CreditApplication);
        const applicationRiskResultsRepository = manager.getRepository(ApplicationRiskResult);
        const countriesRepository = manager.getRepository(Country);
        const countryRulesRepository = manager.getRepository(CountryRule);

        const application = await creditApplicationsRepository.findOne({
          where: { id: applicationId, tenantId },
        });

        if (!application) {
          throw new BadRequestException('Credit application not found');
        }

        const country = await countriesRepository.findOne({
          where: { id: application.countryId },
        });

        if (!country) {
          throw new BadRequestException('Invalid countryId');
        }

        const activeCountryRule = await countryRulesRepository.findOne({
          where: { countryId: country.id, isActive: true },
          order: { version: 'DESC' },
        });

        const bankProvider = this.bankProviderRegistryService.resolve(country.code);
        const bankSnapshot = await bankProvider.fetchBankInfo(application.documentId);
        const evaluation = this.riskEvaluatorService.evaluateRisk(
          country.code,
          application,
          bankSnapshot,
          activeCountryRule,
        );

        const riskResult = applicationRiskResultsRepository.create({
          applicationId: application.id,
          tenantId,
          countryId: application.countryId,
          debtToIncomeRatio: evaluation.debtToIncomeRatio,
          riskScore: evaluation.riskScore,
          decision: evaluation.decision,
          rawBankSnapshot: evaluation.rawBankSnapshot,
        });
        await applicationRiskResultsRepository.save(riskResult);

        if (evaluation.decision === APPLICATION_RISK_DECISION.REVIEW) {
          application.status = CREDIT_APPLICATION_STATUS.IN_REVIEW;
          await creditApplicationsRepository.save(application);
        }

        return { application, riskResult };
      },
    );
  }
}

