import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import type { Tenant } from '../entities/tenant.entity';

export class TenantResponseDto {
  @Expose()
  @ApiProperty({ description: 'Tenant identifier', example: 1 })
  id: string;

  @Expose()
  @ApiProperty({ description: 'Tenant name', example: 'Acme Corp' })
  name: string;

  constructor(tenant: Tenant) {
    this.id = tenant.id;
    this.name = tenant.name;
  }
}
