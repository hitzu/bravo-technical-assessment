import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

import { USER_ROLES } from '../../common/types/user-roles.type';
import { USER_STATUS } from '../../common/types/user-status.type';

export class CreateUserDto {
  @ApiProperty({
    description: 'Tenant identifier the user belongs to',
    example: '5b8c2a0e-64c1-4b33-8d66-1b4d7b7bf69a',
  })
  @IsNotEmpty()
  @IsUUID()
  tenantId!: string;

  @ApiProperty({
    description: 'User email (unique per tenant)',
    example: 'teacher@school.edu',
  })
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'User full name',
    example: 'Jane Teacher',
  })
  @IsNotEmpty()
  @IsString()
  fullName!: string;

  @ApiProperty({
    description: 'Role assigned to the user',
    enum: USER_ROLES,
    example: USER_ROLES.AGENT,
  })
  @IsNotEmpty()
  @IsIn(Object.values(USER_ROLES))
  role!: USER_ROLES;

  @ApiProperty({
    required: false,
    description: 'User status',
    enum: USER_STATUS,
    example: USER_STATUS.ACTIVE,
  })
  @IsOptional()
  @IsIn(Object.values(USER_STATUS))
  status?: USER_STATUS;
}

