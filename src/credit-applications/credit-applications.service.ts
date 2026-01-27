import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { FindOptionsWhere, Repository } from 'typeorm';

import type { AuthUserRole } from '../auth/types/auth-user-context';
import { AsyncJob } from '../async-jobs/entities/async-job.entity';
import { ASYNC_JOB_STATUS } from '../async-jobs/types/async-job-status.type';
import { ASYNC_JOB_TYPE } from '../async-jobs/types/async-job-type.type';
import type { CachePort } from '../cache/cache.port';
import { CACHE_PORT } from '../cache/cache.port';
import { USER_ROLES } from '../common/types/user-roles.type';
import { CREDIT_APPLICATION_STATUS } from '../common/types/credit-application-status.type';
import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';
import { ApplicationRiskResult } from './entities/application-risk-result.entity';
import { CreditApplication } from './entities/credit-applications.entity';
import type { CreateCreditApplicationDto } from './dto/create-credit-application.dto';
import type { ListCreditApplicationsQueryDto } from './dto/list-credit-applications.query.dto';
import type { ListRiskDlqCreditApplicationsQueryDto } from './dto/list-risk-dlq-credit-applications.query.dto';
import { Country } from '../countries/entities/country.entity';
import { COUNTRY_STATUS } from '../common/types/country-status.type';

type ApplicationDetail = {
  application: CreditApplication;
  riskResult: ApplicationRiskResult | null;
};

const TTL_APPLICATION_DETAIL_MS = 60_000;

@Injectable()
export class CreditApplicationsService {
  private readonly logger = new Logger(CreditApplicationsService.name);

  constructor(
    @InjectRepository(CreditApplication)
    private readonly creditApplicationsRepository: Repository<CreditApplication>,
    @InjectRepository(ApplicationRiskResult)
    private readonly applicationRiskResultsRepository: Repository<ApplicationRiskResult>,
    @InjectRepository(AsyncJob)
    private readonly asyncJobsRepository: Repository<AsyncJob>,
    @InjectRepository(Country)
    private readonly countriesRepository: Repository<Country>,
    @Inject(CACHE_PORT)
    private readonly cache: CachePort,
  ) { }

  async createApplication(
    tenantId: string,
    userId: string,
    role: AuthUserRole,
    dto: CreateCreditApplicationDto,
  ): Promise<CreditApplication> {
    this.assertRoleAllowed(role, [USER_ROLES.ADMIN, USER_ROLES.AGENT]);
    if (dto.monthlyIncome < 0) {
      throw new BadRequestException('monthlyIncome must be >= 0');
    }
    if (dto.requestedAmount < 0) {
      throw new BadRequestException('requestedAmount must be >= 0');
    }

    const country = await this.countriesRepository.findOne({
      where: { id: dto.countryId },
    });

    if (!country || country.status !== COUNTRY_STATUS.ACTIVE) {
      throw new BadRequestException(EXCEPTION_RESPONSE.INVALID_COUNTRY);
    }

    this.validateDocumentForCountry(dto.documentId, country);

    const entity = this.creditApplicationsRepository.create({
      tenantId,
      createdBy: userId,
      countryId: dto.countryId,
      fullName: dto.fullName,
      documentId: dto.documentId,
      monthlyIncome: dto.monthlyIncome,
      requestedAmount: dto.requestedAmount,
      status: CREDIT_APPLICATION_STATUS.PENDING,
      bankInfo: null,
      forceRiskFailure: dto.forceRiskFailure,
    });

    await this.creditApplicationsRepository.save(entity);



    return this.getApplication(tenantId, userId, role, entity.id);
  }

  async listApplications(
    tenantId: string,
    userId: string,
    role: AuthUserRole,
    filters: ListCreditApplicationsQueryDto,
  ): Promise<{
    data: CreditApplication[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    this.assertRoleAllowed(role, [USER_ROLES.ADMIN, USER_ROLES.AGENT]);

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where: FindOptionsWhere<CreditApplication> = { tenantId };
    if (filters.countryId) {
      where.countryId = filters.countryId;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (role === USER_ROLES.AGENT) {
      where.createdBy = userId;
    }

    const [data, total] = await this.creditApplicationsRepository.findAndCount({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip,
      take,
    });

    return {
      data,
      total,
      page,
      pageSize,
    };
  }

  async listApplicationsWithRiskEvalDlq(
    tenantId: string,
    userId: string,
    role: AuthUserRole,
    filters: ListRiskDlqCreditApplicationsQueryDto,
  ): Promise<{
    data: Array<{
      application: CreditApplication;
      riskEvalJob: Pick<AsyncJob, 'status' | 'attempts' | 'lastError'>;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    this.assertRoleAllowed(role, [USER_ROLES.ADMIN, USER_ROLES.AGENT]);

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const dlqJobSubQuery = this.asyncJobsRepository
      .createQueryBuilder('job')
      .select('job.status', 'status')
      .addSelect('job.attempts', 'attempts')
      .addSelect('job.lastError', 'last_error')
      .addSelect(`job.payload->>'applicationId'`, 'application_id')
      .where('job.tenantId = :tenantId', { tenantId })
      .andWhere('job.type = :jobType', { jobType: ASYNC_JOB_TYPE.RISK_EVAL })
      .andWhere('job.status = :jobStatus', { jobStatus: ASYNC_JOB_STATUS.DLQ })
      .distinctOn([`job.payload->>'applicationId'`])
      .orderBy(`job.payload->>'applicationId'`, 'ASC')
      .addOrderBy('job.updatedAt', 'DESC');

    const baseQuery = this.creditApplicationsRepository
      .createQueryBuilder('application')
      .leftJoinAndSelect('application.user', 'user')
      .innerJoin(
        `(${dlqJobSubQuery.getQuery()})`,
        'dlqjob',
        `dlqjob."application_id" = application.id::text`,
      )
      .addSelect('dlqjob.status', 'dlqjob_status')
      .addSelect('dlqjob.attempts', 'dlqjob_attempts')
      .addSelect('dlqjob."last_error"', 'dlqjob_last_error')
      .where('application.tenantId = :tenantId', { tenantId })
      .orderBy('application.createdAt', 'DESC');

    if (filters.countryId) {
      baseQuery.andWhere('application.countryId = :countryId', {
        countryId: filters.countryId,
      });
    }

    if (filters.status) {
      baseQuery.andWhere('application.status = :applicationStatus', {
        applicationStatus: filters.status,
      });
    }

    if (role === USER_ROLES.AGENT) {
      baseQuery.andWhere('application.createdBy = :userId', { userId });
    }

    baseQuery.setParameters(dlqJobSubQuery.getParameters());

    const countQuery = this.creditApplicationsRepository
      .createQueryBuilder('application')
      .innerJoin(
        `(${dlqJobSubQuery.getQuery()})`,
        'dlqjob',
        `dlqjob."application_id" = application.id::text`,
      )
      .where('application.tenantId = :tenantId', { tenantId })
      .setParameters(dlqJobSubQuery.getParameters());

    if (filters.countryId) {
      countQuery.andWhere('application.countryId = :countryId', {
        countryId: filters.countryId,
      });
    }

    if (filters.status) {
      countQuery.andWhere('application.status = :applicationStatus', {
        applicationStatus: filters.status,
      });
    }

    if (role === USER_ROLES.AGENT) {
      countQuery.andWhere('application.createdBy = :userId', { userId });
    }

    const [rawAndEntities, total] = await Promise.all([
      baseQuery.skip(skip).take(take).getRawAndEntities(),
      countQuery.getCount(),
    ]);

    const data = rawAndEntities.entities.map((application, index) => {
      const raw = rawAndEntities.raw[index] as {
        dlqjob_status: AsyncJob['status'];
        dlqjob_attempts: AsyncJob['attempts'];
        dlqjob_last_error: AsyncJob['lastError'];
      };

      return {
        application,
        riskEvalJob: {
          status: raw.dlqjob_status,
          attempts: Number(raw.dlqjob_attempts),
          lastError: raw.dlqjob_last_error ?? null,
        },
      };
    });

    return {
      data,
      total,
      page,
      pageSize,
    };
  }

  async getApplication(
    tenantId: string,
    userId: string,
    role: AuthUserRole,
    id: string,
  ): Promise<CreditApplication> {
    this.assertRoleAllowed(role, [USER_ROLES.ADMIN, USER_ROLES.AGENT]);

    const application = await this.creditApplicationsRepository.findOne({
      where: { id, tenantId },
      relations: ['user'],
    });

    if (!application) {
      throw new NotFoundException('Credit application not found');
    }

    if (role === USER_ROLES.AGENT && application.createdBy !== userId) {
      throw new ForbiddenException(EXCEPTION_RESPONSE.INSUFFICIENT_ROLE);
    }

    return application;
  }

  async getApplicationWithLatestRiskResult(
    tenantId: string,
    userId: string,
    role: AuthUserRole,
    id: string,
  ): Promise<ApplicationDetail> {

    const cacheKey = this.buildApplicationDetailCacheKey(tenantId, id);
    const cached = this.cache.get<ApplicationDetail>(cacheKey);
    if (cached !== undefined) {
      this.assertRoleAllowed(role, [USER_ROLES.ADMIN, USER_ROLES.AGENT]);
      if (
        role === USER_ROLES.AGENT &&
        cached.application.createdBy !== userId
      ) {
        throw new ForbiddenException(EXCEPTION_RESPONSE.INSUFFICIENT_ROLE);
      }
      this.logger.log('Returning cached application detail');
      return cached;
    }


    const application = await this.getApplication(tenantId, userId, role, id);

    const riskResult = await this.applicationRiskResultsRepository.findOne({
      where: { tenantId, applicationId: application.id },
      order: { createdAt: 'DESC' },
    });


    const detail: ApplicationDetail = { application, riskResult };
    this.cache.set(cacheKey, detail, TTL_APPLICATION_DETAIL_MS);
    return detail;
  }

  async updateStatus(
    tenantId: string,
    userId: string,
    role: AuthUserRole,
    id: string,
    newStatus: CREDIT_APPLICATION_STATUS,
  ): Promise<CreditApplication> {
    this.assertRoleAllowed(role, [USER_ROLES.ADMIN]);
    void userId;

    const application = await this.creditApplicationsRepository.findOne({
      where: { id, tenantId },
    });

    if (!application) {
      throw new NotFoundException(EXCEPTION_RESPONSE.CREDIT_APPLICATION_NOT_FOUND);
    }
    this.logger.log({ application }, ' en update status application porque no se que show :( jajajaja');
    if (application.status !== CREDIT_APPLICATION_STATUS.IN_REVIEW) {
      throw new BadRequestException(
        EXCEPTION_RESPONSE.CREDIT_APPLICATION_STATUS_CAN_ONLY_BE_MANUALLY_CHANGED_FROM_IN_REVIEW,
      );
    }
    this.logger.log({ newStatus }, 'newStatus');
    const isAllowedTargetStatus =
      newStatus === CREDIT_APPLICATION_STATUS.APPROVED ||
      newStatus === CREDIT_APPLICATION_STATUS.REJECTED;
    if (!isAllowedTargetStatus) {
      throw new BadRequestException(
        EXCEPTION_RESPONSE.CREDIT_APPLICATION_STATUS_MUST_BE_APPROVED_OR_REJECTED_FOR_MANUAL_ADMIN_UPDATE,
      );
    }
    this.logger.log({ newStatus }, 'newStatus_2');
    application.status = newStatus;
    const updated = await this.creditApplicationsRepository.save(application);
    this.logger.log(
      { applicationId: updated.id, tenantId, status: updated.status },
      'Credit application status updated',
    );

    return updated;
  }

  private assertRoleAllowed(role: AuthUserRole, allowed: USER_ROLES[]): void {
    const normalizedRole = role as unknown as USER_ROLES;
    if (!allowed.includes(normalizedRole)) {
      throw new ForbiddenException(EXCEPTION_RESPONSE.INSUFFICIENT_ROLE);
    }
  }

  private validateDocumentForCountry(documentId: unknown, country: Country): void {
    const pattern = country.documentRegexPattern?.trim();
    if (!pattern) {
      return;
    }

    if (typeof documentId !== 'string' || documentId.trim().length === 0) {
      throw new BadRequestException(
        `documentId is required for country ${country.code}`,
      );
    }

    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch (error) {
      this.logger.error(
        { countryCode: country.code, documentRegexPattern: pattern, err: error },
        'Invalid country document regex pattern (skipping validation)',
      );
      this.logger.warn(
        { countryCode: country.code },
        'Skipping document validation due to invalid country regex pattern',
      );
      return;
    }

    if (!regex.test(documentId)) {
      const label = country.documentLabel ?? 'document';
      throw new BadRequestException(
        `Invalid document format for country`,
      );
    }
  }

  private buildApplicationDetailCacheKey(tenantId: string, applicationId: string): string {
    return `application:${tenantId}:${applicationId}`;
  }
}

