import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

import { CREDIT_APPLICATION_STATUS } from '../../common/types/credit-application-status.type';

export class ListCreditApplicationsQueryDto {
  @ApiPropertyOptional({
    description: 'Country identifier (UUID)',
    example: '0d3a3e64-3af4-46c4-9e2d-56c1920fd5a9',
  })
  @IsOptional()
  @IsUUID()
  countryId?: string;

  @ApiPropertyOptional({
    description: 'Application status filter',
    enum: CREDIT_APPLICATION_STATUS,
    example: CREDIT_APPLICATION_STATUS.PENDING,
  })
  @IsOptional()
  @IsIn(Object.values(CREDIT_APPLICATION_STATUS))
  status?: CREDIT_APPLICATION_STATUS;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    default: 1,
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Page size',
    default: 20,
    example: 20,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  pageSize?: number;
}

