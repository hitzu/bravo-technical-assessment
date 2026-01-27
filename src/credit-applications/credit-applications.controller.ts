import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AuthUser } from '../auth/decorators/auth-user.decorator';
import type { AuthUserContext } from '../auth/types/auth-user-context';
import { CreditApplicationsService } from './credit-applications.service';
import { CreateCreditApplicationDto } from './dto/create-credit-application.dto';
import { CreditApplicationResponseDto } from './dto/credit-application-response.dto';
import { ListCreditApplicationsQueryDto } from './dto/list-credit-applications.query.dto';
import { ListCreditApplicationsResponseDto } from './dto/list-credit-applications-response.dto';
import { ListRiskDlqCreditApplicationsQueryDto } from './dto/list-risk-dlq-credit-applications.query.dto';
import { UpdateCreditApplicationStatusDto } from './dto/update-credit-application-status.dto';
import { EXCEPTION_RESPONSE } from '../config/errors/exception-response.config';

@ApiTags('Credit Applications')
@Controller('applications')
export class CreditApplicationsController {
  private readonly logger = new Logger(CreditApplicationsController.name);

  constructor(
    private readonly creditApplicationsService: CreditApplicationsService,
  ) { }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create credit application' })
  @ApiCreatedResponse({ type: CreditApplicationResponseDto })
  async create(
    @AuthUser() authUser: AuthUserContext,
    @Body() dto: CreateCreditApplicationDto,
  ): Promise<CreditApplicationResponseDto> {
    this.logger.log(
      { tenantId: authUser.tenantId, userId: authUser.userId },
      'Creating credit application',
    );

    if (authUser.tenantId !== dto.tenantId) {
      throw new ForbiddenException(EXCEPTION_RESPONSE.TENANT_ID_MISMATCH);
    }

    const created = await this.creditApplicationsService.createApplication(
      authUser.tenantId,
      authUser.userId,
      authUser.role,
      dto,
    );
    return new CreditApplicationResponseDto(created);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List credit applications (RBAC-scoped)' })
  @ApiOkResponse({ type: ListCreditApplicationsResponseDto })
  async list(
    @AuthUser() authUser: AuthUserContext,
    @Query() query: ListCreditApplicationsQueryDto,
  ): Promise<ListCreditApplicationsResponseDto> {
    const result = await this.creditApplicationsService.listApplications(
      authUser.tenantId,
      authUser.userId,
      authUser.role,
      query,
    );

    return new ListCreditApplicationsResponseDto({
      data: result.data.map((a) => new CreditApplicationResponseDto(a)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  }

  @Get('risk-evaluations/dlq')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List credit applications whose risk evaluation went to DLQ (RBAC-scoped)',
  })
  @ApiOkResponse({ type: ListCreditApplicationsResponseDto })
  async listRiskEvaluationsDlq(
    @AuthUser() authUser: AuthUserContext,
    @Query() query: ListRiskDlqCreditApplicationsQueryDto,
  ): Promise<ListCreditApplicationsResponseDto> {
    const result =
      await this.creditApplicationsService.listApplicationsWithRiskEvalDlq(
        authUser.tenantId,
        authUser.userId,
        authUser.role,
        query,
      );

    return new ListCreditApplicationsResponseDto({
      data: result.data.map((row) => new CreditApplicationResponseDto(row.application, null, row.riskEvalJob)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get credit application detail' })
  @ApiOkResponse({ type: CreditApplicationResponseDto })
  async getById(
    @AuthUser() authUser: AuthUserContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<CreditApplicationResponseDto> {
    const result = await this.creditApplicationsService.getApplicationWithLatestRiskResult(
      authUser.tenantId,
      authUser.userId,
      authUser.role,
      id,
    );
    return new CreditApplicationResponseDto(result.application, result.riskResult);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update credit application status (ADMIN only)' })
  @ApiOkResponse({ type: CreditApplicationResponseDto })
  async updateStatus(
    @AuthUser() authUser: AuthUserContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCreditApplicationStatusDto,
  ): Promise<CreditApplicationResponseDto> {
    const updated = await this.creditApplicationsService.updateStatus(
      authUser.tenantId,
      authUser.userId,
      authUser.role,
      id,
      dto.status,
    );
    return new CreditApplicationResponseDto(updated);
  }
}

