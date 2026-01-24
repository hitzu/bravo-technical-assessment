import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import type { User } from '../entities/user.entity';
import { USER_ROLES } from '../../common/types/user-roles.type';
import { USER_STATUS } from '../../common/types/user-status.type';

export class UserResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Unique user identifier',
    example: '0d3a3e64-3af4-46c4-9e2d-56c1920fd5a9',
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: 'Tenant identifier',
    example: '5b8c2a0e-64c1-4b33-8d66-1b4d7b7bf69a',
  })
  tenantId: string;

  @Expose()
  @ApiProperty({ description: 'User email', example: 'teacher@school.edu' })
  email: string;

  @Expose()
  @ApiProperty({ description: 'User full name', example: 'Jane Teacher' })
  fullName: string;

  @Expose()
  @ApiProperty({
    description: 'User role',
    enum: USER_ROLES,
    example: USER_ROLES.AGENT,
  })
  role: USER_ROLES;

  @Expose()
  @ApiProperty({
    description: 'User status',
    enum: USER_STATUS,
    example: USER_STATUS.ACTIVE,
  })
  status: USER_STATUS;

  @Expose()
  @ApiProperty({
    required: false,
    description: 'Fine-grained permissions payload',
    example: { grades: ['READ', 'WRITE'] },
  })
  scopes?: Record<string, unknown> | null;

  @Expose()
  @ApiProperty({
    required: false,
    description: 'Last login timestamp',
    example: '2026-01-17T00:00:00.000Z',
  })
  lastLoginAt?: Date | null;

  constructor(user: User) {
    this.id = user.id;
    this.tenantId = user.tenantId;
    this.email = user.email;
    this.fullName = user.fullName;
    this.role = user.role;
    this.status = user.status;
    this.scopes = user.scopes ?? null;
    this.lastLoginAt = user.lastLoginAt ?? null;
  }
}

