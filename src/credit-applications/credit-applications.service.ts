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
import type { CachePort } from '../cache/cache.port';
import { CACHE_PORT } from '../cache/cache.port';
import { USER_ROLES } from '../common/types/user-roles.type';
import { CREDIT_APPLICATION_STATUS } from '../common/types/credit-application-status.type';
import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';
import { ApplicationRiskResult } from './entities/application-risk-result.entity';
import { CreditApplication } from './entities/credit-applications.entity';
import type { CreateCreditApplicationDto } from './dto/create-credit-application.dto';
import type { ListCreditApplicationsQueryDto } from './dto/list-credit-applications.query.dto';
import { Country } from '../countries/entities/country.entity';

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

    const saved = await this.creditApplicationsRepository.manager.transaction(
      async (manager) => {
        const creditApplicationsRepository = manager.getRepository(CreditApplication);
        const countriesRepository = manager.getRepository(Country);
        const entity = creditApplicationsRepository.create({
          tenantId,
          createdBy: userId,
          countryId: dto.countryId,
          fullName: dto.fullName,
          documentId: dto.documentId,
          monthlyIncome: dto.monthlyIncome,
          requestedAmount: dto.requestedAmount,
          status: CREDIT_APPLICATION_STATUS.PENDING,
          bankInfo: null,
        });

        const created = await creditApplicationsRepository.save(entity);
        const country = await countriesRepository.findOne({
          where: { id: created.countryId },
        });

        if (!country) {
          throw new BadRequestException('Invalid countryId');
        }

        return created;
      },
    );

    this.logger.log(
      { applicationId: saved.id, tenantId, createdBy: userId },
      'Credit application created',
    );

    return saved;
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

  async getApplication(
    tenantId: string,
    userId: string,
    role: AuthUserRole,
    id: string,
  ): Promise<CreditApplication> {
    this.assertRoleAllowed(role, [USER_ROLES.ADMIN, USER_ROLES.AGENT]);

    const application = await this.creditApplicationsRepository.findOne({
      where: { id, tenantId },
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
      throw new NotFoundException('Credit application not found');
    }

    this.assertLegalStatusTransition(application.status, newStatus);

    application.status = newStatus;
    const updated = await this.creditApplicationsRepository.save(application);
    this.logger.log(
      { applicationId: updated.id, tenantId, status: updated.status },
      'Credit application status updated',
    );
    // NOTE: In production this would be backed by Redis using the same CachePort interface.
    this.cache.del(this.buildApplicationDetailCacheKey(tenantId, updated.id));
    return updated;
  }

  private assertRoleAllowed(role: AuthUserRole, allowed: USER_ROLES[]): void {
    const normalizedRole = role as unknown as USER_ROLES;
    if (!allowed.includes(normalizedRole)) {
      throw new ForbiddenException(EXCEPTION_RESPONSE.INSUFFICIENT_ROLE);
    }
  }

  private assertLegalStatusTransition(
    current: CREDIT_APPLICATION_STATUS,
    next: CREDIT_APPLICATION_STATUS,
  ): void {
    const isCurrentTerminal =
      current === CREDIT_APPLICATION_STATUS.APPROVED ||
      current === CREDIT_APPLICATION_STATUS.REJECTED;
    const isNextTerminal =
      next === CREDIT_APPLICATION_STATUS.APPROVED ||
      next === CREDIT_APPLICATION_STATUS.REJECTED;

    if (isCurrentTerminal && isNextTerminal && current !== next) {
      throw new BadRequestException(
        `Invalid status transition from ${current} to ${next}`,
      );
    }
  }

  private buildApplicationDetailCacheKey(tenantId: string, applicationId: string): string {
    return `application:${tenantId}:${applicationId}`;
  }
}

