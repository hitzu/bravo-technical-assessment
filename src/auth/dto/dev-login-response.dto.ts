import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import type { DevTokenRole } from '../guards/dev-token.guard';

export class DevLoginResponseDto {
  @ApiProperty({
    example: 'DEV.v1.5b8c2a0e-64c1-4b33-8d66-1b4d7b7bf69a.0d3a3e64-3af4-46c4-9e2d-56c1920fd5a9.AGENT.1733472000',
    description: 'Dev-only token. NOT for production use.',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: '0d3a3e64-3af4-46c4-9e2d-56c1920fd5a9' })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ example: '5b8c2a0e-64c1-4b33-8d66-1b4d7b7bf69a' })
  @IsUUID()
  @IsNotEmpty()
  tenantId!: string;

  @ApiProperty({
    example: 'ADMIN',
    enum: ['AGENT', 'ADMIN'],
  })
  @IsString()
  @IsIn(['AGENT', 'ADMIN'])
  role!: DevTokenRole;
}
