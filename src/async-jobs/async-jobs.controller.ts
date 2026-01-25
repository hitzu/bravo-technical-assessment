import { Controller, ForbiddenException, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuthUser } from '../auth/decorators/auth-user.decorator';
import type { AuthUserContext } from '../auth/types/auth-user-context';
import { USER_ROLES } from '../common/types/user-roles.type';
import { AsyncJobsProcessorService } from './async-jobs-processor.service';

@ApiTags('Jobs (debug)')
@Controller('jobs')
export class AsyncJobsController {
  constructor(
    private readonly asyncJobsProcessorService: AsyncJobsProcessorService,
  ) { }

  @Post('process')
  @ApiOperation({ summary: 'Process async jobs (debug/admin)' })
  async processJobs(
    @AuthUser() authUser: AuthUserContext,
    @Query('limit') limit?: string,
  ): Promise<{ processed: number; dlq: number }> {
    if (authUser.role !== USER_ROLES.ADMIN) {
      throw new ForbiddenException('Admin role required');
    }

    const normalizedLimit = limit ? Number(limit) : 10;
    const safeLimit =
      Number.isFinite(normalizedLimit) && normalizedLimit > 0
        ? Math.floor(normalizedLimit)
        : 10;

    return this.asyncJobsProcessorService.processPendingJobs(safeLimit);
  }
}

