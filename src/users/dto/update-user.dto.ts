import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

import { USER_ROLES } from '../../common/types/user-roles.type';
import { USER_STATUS } from '../../common/types/user-status.type';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'User email', example: 'viewer@school.edu' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'User full name', example: 'Jane Viewer' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Role assigned to the user',
    enum: USER_ROLES,
    example: USER_ROLES.AGENT || USER_ROLES.ADMIN,
  })
  @IsOptional()
  @IsIn(Object.values(USER_ROLES))
  role?: USER_ROLES;

  @ApiPropertyOptional({
    description: 'Fine-grained permissions payload',
    example: { grades: ['READ'] },
  })
  @IsOptional()
  scopes?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description: 'User status',
    enum: USER_STATUS,
    example: USER_STATUS.SUSPENDED,
  })
  @IsOptional()
  @IsIn(Object.values(USER_STATUS))
  status?: USER_STATUS;
}

